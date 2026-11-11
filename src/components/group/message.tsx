// One message of the group (owner 10.11.2026): own messages on the right in the community's colour, the others on the left with picture and name; the
// team's messages carry a badge. An answer quotes what it answers; a picture or GIF of the team fills the bubble; a poll shows its options with bars and
// takes a tap as the vote; reactions stand below as chips (a tap gives or takes back). A long press opens the menu (components/group/chat.tsx).
// The result of a poll: a member sees it once they voted; the team always, with the number of votes per answer (owner 11.11.2026: "wo sieht Mailin, wenn
// Leute abgestimmt haben").
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { LinkedText } from '@/components/linked-text';
import { Txt } from '@/components/ui';
import type { GroupMessage } from '@/lib/group';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

const time = (sec: number) => new Date(sec * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function Avatar({ m }: { m: GroupMessage }) {
  const p = usePalette();
  const { api } = useSession();
  const initial = (m.author.name.trim()[0] ?? '?').toLocaleUpperCase('de-DE');
  return m.author.avatarUrl && api ? (
    <Image source={{ uri: api.url(m.author.avatarUrl), headers: api.mediaHeaders() }} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" />
  ) : (
    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: m.author.isTeam ? p.accent : p.surfaceAlt }}>
      <Txt variant="small" color={m.author.isTeam ? p.onAccent : p.text} style={{ fontWeight: '700' }}>{initial}</Txt>
    </View>
  );
}

function PollView({ m, onVote, team }: { m: GroupMessage; onVote: (options: number[]) => void; team: boolean }) {
  const p = usePalette();
  const poll = m.poll;
  if (!poll) return null;
  // the bars: after one's own vote; the team sees them always
  const voted = poll.mine.length > 0 || team;
  const total = Math.max(1, poll.counts.reduce((a, b) => a + b, 0));
  return (
    <View style={{ gap: space.s, minWidth: 220 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Ionicons name="stats-chart" size={14} color={p.accent} />
        <Txt variant="caption" color={p.accent}>{poll.multi ? 'Umfrage · mehrere Antworten' : 'Umfrage'}</Txt>
      </View>
      <Txt variant="heading">{poll.question}</Txt>
      {poll.options.map((option, i) => {
        const mine = poll.mine.includes(i);
        const share = (poll.counts[i] ?? 0) / total;
        const next = poll.multi ? (mine ? poll.mine.filter((x) => x !== i) : [...poll.mine, i]) : mine ? [] : [i];
        return (
          <Pressable
            key={`${i}-${option}`}
            accessibilityRole={poll.multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: mine }}
            accessibilityLabel={`${option}${voted ? `, ${team ? `${poll.counts[i] ?? 0} Stimmen, ` : ''}${Math.round(share * 100)} Prozent` : ''}`}
            onPress={() => onVote(next)}
            style={({ pressed }) => ({ minHeight: 44, borderRadius: radius.m, borderWidth: 1.5, borderColor: mine ? p.accent : p.line, overflow: 'hidden', opacity: pressed ? 0.75 : 1, justifyContent: 'center' })}
          >
            {voted ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(share * 100)}%`, backgroundColor: p.accentSoft }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m }}>
              <Ionicons name={mine ? (poll.multi ? 'checkbox' : 'radio-button-on') : (poll.multi ? 'square-outline' : 'radio-button-off')} size={18} color={mine ? p.accent : p.textMuted} />
              <Txt style={{ flex: 1 }}>{option}</Txt>
              {voted ? (
                <Txt variant="small" muted style={{ fontVariant: ['tabular-nums'] }}>
                  {team ? `${poll.counts[i] ?? 0} · ` : ''}{Math.round(share * 100)} %
                </Txt>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <Txt variant="small" muted>
        {poll.voters === 1 ? '1 Person hat abgestimmt' : `${poll.voters} Personen haben abgestimmt`}{poll.mine.length > 0 ? ' · Tippe nochmal zum Ändern' : ''}
      </Txt>
    </View>
  );
}

export function MessageBubble({ m, team = false, onLongPress, onReact, onVote, onOpenImage }: {
  m: GroupMessage; team?: boolean; onLongPress: () => void; onReact: (emoji: string) => void; onVote: (options: number[]) => void; onOpenImage: (url: string) => void;
}) {
  const p = usePalette();
  const { api } = useSession();
  const own = m.mine;
  // a poll stands on a neutral card also when it is one's own: its bars and numbers need the light ground
  const filled = own && !m.deleted && m.kind !== 'poll';
  const bg = m.deleted ? 'transparent' : filled ? p.accent : m.author.isTeam && m.kind !== 'poll' ? p.accentSoft : p.surface;
  const fg = filled ? p.onAccent : p.text;
  const imageRatio = m.image && m.image.width > 0 && m.image.height > 0 ? m.image.width / m.image.height : 4 / 3;
  return (
    <View style={{ flexDirection: own ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: space.s, paddingHorizontal: space.l, paddingVertical: 3 }}>
      {own ? null : <Avatar m={m} />}
      <View style={{ maxWidth: '82%', gap: 4, alignItems: own ? 'flex-end' : 'flex-start' }}>
        {own ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
            <Txt variant="small" style={{ fontWeight: '700' }}>{m.author.name}</Txt>
            {m.author.isTeam ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: p.accent }}>
                <Txt variant="small" color={p.onAccent} style={{ fontSize: 11, lineHeight: 15, fontWeight: '700' }}>Coach</Txt>
              </View>
            ) : null}
          </View>
        )}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityHint="Lange drücken für Antworten, Reagieren, Melden"
          style={{
            borderRadius: radius.l, backgroundColor: bg, padding: m.image ? 4 : space.m, gap: space.s, overflow: 'hidden',
            borderWidth: m.deleted || !filled ? 1 : 0, borderColor: p.line, borderStyle: m.deleted ? 'dashed' : 'solid',
          }}
        >
          {m.hidden ? <Txt variant="small" color={p.danger} style={{ paddingHorizontal: m.image ? space.s : 0 }}>Ausgeblendet nach Meldungen ({m.reports ?? 0})</Txt> : null}
          {!m.hidden && m.reports ? <Txt variant="small" color={p.danger} style={{ paddingHorizontal: m.image ? space.s : 0 }}>Gemeldet ({m.reports})</Txt> : null}
          {m.replyTo ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: own ? p.onAccent : p.accent, paddingLeft: space.s, opacity: 0.85, marginHorizontal: m.image ? space.s : 0 }}>
              <Txt variant="small" color={fg} style={{ fontWeight: '700' }}>{m.replyTo.authorName}</Txt>
              <Txt variant="small" color={fg} numberOfLines={2}>{m.replyTo.deleted ? 'Nachricht gelöscht' : m.replyTo.kind === 'image' && !m.replyTo.body ? 'Bild' : m.replyTo.body}</Txt>
            </View>
          ) : null}
          {m.deleted ? <Txt variant="small" muted style={{ fontStyle: 'italic' }}>Nachricht gelöscht</Txt> : null}
          {m.image && api ? (
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Bild ansehen" onPress={() => onOpenImage(m.image?.url ?? '')} onLongPress={onLongPress}>
              <Image
                source={{ uri: api.url(m.image.url), headers: api.mediaHeaders() }}
                style={{ width: 240, aspectRatio: Math.max(0.6, Math.min(1.8, imageRatio)), borderRadius: radius.l - 4 }}
                contentFit="cover"
                autoplay
              />
            </Pressable>
          ) : null}
          {m.poll ? <PollView m={m} onVote={onVote} team={team} /> : null}
          {m.body ? <LinkedText text={m.body} color={fg} style={{ paddingHorizontal: m.image ? space.s : 0, paddingBottom: m.image ? space.xs : 0 }} /> : null}
        </Pressable>
        <View style={{ flexDirection: own ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
          {m.pinned ? <Ionicons name="pin" size={12} color={p.accent} accessibilityLabel="Angepinnt" /> : null}
          <Txt variant="small" muted style={{ fontSize: 11, lineHeight: 15 }}>{time(m.createdAt)}</Txt>
          {m.reactions.map((r) => (
            <Pressable
              key={r.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', von dir' : ''}`}
              onPress={() => onReact(r.emoji)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, minHeight: 26, borderRadius: 13, backgroundColor: r.mine ? p.accentSoft : p.surfaceAlt, borderWidth: r.mine ? 1 : 0, borderColor: p.accent }}
            >
              <Txt variant="small">{r.emoji}</Txt>
              <Txt variant="small" style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>{r.count}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
