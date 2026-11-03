// Short exercise videos of the routine are kept on the phone: loaded once in the background, then they play from the file, start
// at once and loop without touching the network or the server's limit per video and day (worker/modules/player/quota.ts). Longer
// videos stream like a lesson (owner 03.11.2026: loading them first made the routine slower than the lessons), as does every
// video that is not there yet: nobody waits for a file.
// Loaded piece by piece, in the size the website's player asks for as well, one piece at a time and the current exercise
// first; a broken connection or a closed screen loses nothing, the next visit goes on from there. A video replaced in the
// admin has another ETag and is loaded again (the new file counts from the next session: a running one is never swapped). In the
// browser (development only) the files are kept in memory.
import { fetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform } from 'react-native';
import { ApiError, type ApiClient } from './api';
import type { PlayResponse } from './types';

const MIB = 1024 * 1024;
const PIECE_BYTES = 8 * MIB;
/** Larger videos stream. Below the server's limit of 128 MiB per minute and video (quota.ts), so loading needs no brake. */
const FILE_MAX_BYTES = 96 * MIB;
/** The phone keeps this much, the videos not used for the longest time go first. */
const KEEP_BYTES = 1024 * MIB;
const MAX_FAILURES = 3;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

// ---------- where the files are ----------

interface Store {
  /** The newest complete file of a video. */
  finished(id: string): string | null;
  has(id: string, version: string): boolean;
  /** Bytes already there of an unfinished file. */
  partSize(id: string, version: string): number;
  write(id: string, version: string, offset: number, bytes: Uint8Array): Promise<void>;
  complete(id: string, version: string, keep: readonly string[]): string;
  remove(id: string): void;
  clear(): void;
}

const folder = () => {
  const dir = new Directory(Paths.cache, 'uebungen');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
};
const filesIn = (dir: Directory) => dir.list().filter((e): e is File => e instanceof File);
const usedAt = (f: File) => f.lastModified ?? 0;

const phoneStore: Store = {
  finished: (id) => {
    const [newest, ...older] = filesIn(folder())
      .filter((f) => f.name.startsWith(`${id}.`) && f.name.endsWith('.mp4'))
      .sort((a, b) => usedAt(b) - usedAt(a));
    for (const f of older) f.delete();
    return newest?.uri ?? null;
  },
  has: (id, version) => new File(folder(), `${id}.${version}.mp4`).exists,
  partSize: (id, version) => {
    const part = new File(folder(), `${id}.${version}.part`);
    return part.exists ? part.size : 0;
  },
  write: async (id, version, offset, bytes) => {
    const part = new File(folder(), `${id}.${version}.part`);
    if (!part.exists) part.create();
    const handle = part.open();
    try {
      handle.offset = offset;
      await handle.writeBytes(bytes);
    } finally {
      handle.close();
    }
  },
  complete: (id, version, keep) => {
    const dir = folder();
    const target = new File(dir, `${id}.${version}.mp4`);
    new File(dir, `${id}.${version}.part`).moveSync(target);
    // the oldest go when the phone keeps too much (never those of this session)
    let total = 0;
    for (const f of filesIn(dir).sort((a, b) => usedAt(b) - usedAt(a))) {
      total += f.size;
      if (total > KEEP_BYTES && !keep.some((k) => f.name.startsWith(`${k}.`))) f.delete();
    }
    return target.uri;
  },
  remove: (id) => {
    for (const f of filesIn(folder())) if (f.name.startsWith(`${id}.`)) f.delete();
  },
  clear: () => {
    const dir = new Directory(Paths.cache, 'uebungen');
    if (dir.exists) dir.delete();
  },
};

const memory = { parts: new Map<string, Uint8Array[]>(), files: new Map<string, { version: string; uri: string }>() };
const memorySize = (key: string) => (memory.parts.get(key) ?? []).reduce((sum, b) => sum + b.length, 0);

const memoryStore: Store = {
  finished: (id) => memory.files.get(id)?.uri ?? null,
  has: (id, version) => memory.files.get(id)?.version === version,
  partSize: (id, version) => memorySize(`${id}.${version}`),
  write: async (id, version, _offset, bytes) => {
    const key = `${id}.${version}`;
    memory.parts.set(key, [...(memory.parts.get(key) ?? []), bytes]);
  },
  complete: (id, version) => {
    const key = `${id}.${version}`;
    const uri = URL.createObjectURL(new Blob((memory.parts.get(key) ?? []) as BlobPart[], { type: 'video/mp4' }));
    memory.parts.delete(key);
    memory.files.set(id, { version, uri });
    return uri;
  },
  remove: (id) => { memory.files.delete(id); },
  clear: () => {
    memory.parts.clear();
    memory.files.clear();
  },
};

const store = Platform.OS === 'web' ? memoryStore : phoneStore;

/** After logging out nothing of the member stays on the phone. */
export function clearExerciseVideos(): void {
  try {
    store.clear();
  } catch { /* the cache is cleaned by the system anyway */ }
}

// ---------- loading ----------

/** One video on its way: the stream address, what it is and how far it is. */
interface Job { url: string; expiresAt: number; size: number; version: string; offset: number }

async function openJob(api: ApiClient, id: string): Promise<Job> {
  const play = await api.post<PlayResponse>(`/api/member/videos/${encodeURIComponent(id)}/play`);
  const url = api.url(play.src);
  // the first byte tells the rest: the whole size in Content-Range, and the ETag
  const first = await fetch(url, { headers: { ...api.mediaHeaders(), Range: 'bytes=0-0' } });
  if (first.status !== 206) throw new ApiError(first.status, `http_${first.status}`);
  await first.arrayBuffer();
  const size = Number(/\/(\d+)$/.exec(first.headers.get('content-range') ?? '')?.[1] ?? 0);
  if (!size) throw new ApiError(0, 'no_size');
  const version = `${size}-${(first.headers.get('etag') ?? '').replace(/\W/g, '').slice(0, 20)}`;
  return { url, expiresAt: play.expiresAt, size, version, offset: size > FILE_MAX_BYTES ? 0 : store.partSize(id, version) };
}

async function loadPiece(api: ApiClient, job: Job): Promise<Uint8Array> {
  const end = Math.min(job.offset + PIECE_BYTES, job.size) - 1;
  const res = await fetch(job.url, { headers: { ...api.mediaHeaders(), Range: `bytes=${job.offset}-${end}` } });
  if (res.status !== 206) throw new ApiError(res.status, `http_${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length !== end - job.offset + 1) throw new ApiError(0, 'short_piece');
  return bytes;
}

export interface ExerciseVideos {
  /** The file of a video, when it is completely on the phone. */
  file(id: string): string | null;
  /** Its file does not play: it comes as a stream. */
  failed(id: string): boolean;
  /** A file that does not play: away with it, the video comes as a stream. */
  drop(id: string): void;
}

/**
 * Keeps the videos `ids` on the phone. `current` loads first; while `paused` nothing loads (a video that streams needs the
 * connection for itself).
 */
export function useExerciseVideos(api: ApiClient, ids: readonly string[], current: string | null, paused: RefObject<boolean>): ExerciseVideos {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const first = useRef(current);
  useEffect(() => {
    first.current = current;
  }, [current]);
  const key = [...new Set(ids)].join(',');

  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const list = key.split(',');
    const todo = new Set(list);
    const jobs = new Map<string, Job>();
    const failures = new Map<string, number>();
    void (async () => {
      // what is on the phone is there at once (it is checked against the server afterwards)
      const known: Record<string, string> = {};
      for (const id of list) {
        try {
          const uri = store.finished(id);
          if (uri) known[id] = uri;
        } catch { /* it is loaded again */ }
      }
      setFiles((f) => ({ ...known, ...f }));

      while (!stopped && todo.size > 0) {
        if (paused.current) {
          await sleep(1000);
          continue;
        }
        const wanted = first.current;
        const id = (wanted && todo.has(wanted) ? wanted : todo.values().next().value) as string;
        try {
          let job = jobs.get(id);
          if (!job || job.expiresAt - Date.now() / 1000 < 30) {
            job = await openJob(api, id);
            jobs.set(id, job);
          }
          if (job.size > FILE_MAX_BYTES || store.has(id, job.version)) {
            todo.delete(id);
            continue;
          }
          const bytes = await loadPiece(api, job);
          if (stopped) return;
          await store.write(id, job.version, job.offset, bytes);
          job.offset += bytes.length;
          failures.delete(id);
          if (job.offset >= job.size) {
            const uri = store.complete(id, job.version, list);
            // a running session keeps the file it has
            setFiles((f) => (f[id] ? f : { ...f, [id]: uri }));
            todo.delete(id);
          }
        } catch (err) {
          if (stopped) return;
          const status = err instanceof ApiError ? err.status : 0;
          const times = (failures.get(id) ?? 0) + 1;
          failures.set(id, times);
          // a new address may help: it ran out, or another player got a newer one ("one stream per member")
          if (status === 403 || status === 409 || status === 416) jobs.delete(id);
          // 429: the limit of the day is used up, 404: the video is gone
          if (status === 429 || status === 404 || times >= MAX_FAILURES) {
            todo.delete(id);
          } else {
            await sleep(1500 * times);
          }
        }
      }
    })();
    return () => { stopped = true; };
  }, [api, key, paused]);

  return {
    file: (id) => files[id] ?? null,
    failed: (id) => !!failed[id],
    drop: (id) => {
      try {
        store.remove(id);
      } catch { /* the cache is cleaned by the system anyway */ }
      setFiles(({ [id]: _gone, ...rest }) => rest);
      setFailed((x) => ({ ...x, [id]: true }));
    },
  };
}
