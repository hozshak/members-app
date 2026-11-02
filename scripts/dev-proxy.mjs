// Development only: the app in the browser (Expo web) and a local membership software under ONE address, so the browser
// needs no CORS. /api/* and /media/* go to the software (default http://127.0.0.1:8788), everything else to the Expo
// dev server (default http://127.0.0.1:8081, including its websocket). Towards the software the request looks like the
// phone's: no Origin, no fetch metadata, no cookies — the app authenticates with its Bearer token.
// Start: node scripts/dev-proxy.mjs [port=8090]  ·  env BACKEND, EXPO
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.argv[2] ?? 8090);
const BACKEND = new URL(process.env.BACKEND ?? 'http://127.0.0.1:8788');
const EXPO = new URL(process.env.EXPO ?? 'http://127.0.0.1:8081');
const DROP_TO_BACKEND = ['origin', 'referer', 'cookie', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user'];

const toBackend = (url) => url.startsWith('/api/') || url.startsWith('/media/');

const server = http.createServer((req, res) => {
  const target = toBackend(req.url ?? '/') ? BACKEND : EXPO;
  const headers = { ...req.headers, host: target.host };
  if (target === BACKEND) {
    // the browser's <video> cannot send the app's headers: with a cookie `dev_media_token` the proxy adds them (videos then
    // really play in the browser; set it once with the token of the test member)
    const media = (req.url ?? '').startsWith('/media/') && /(?:^|;\s*)dev_media_token=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    if (media) {
      headers.authorization = `Bearer ${media}`;
      headers['x-client'] = 'members-app';
    }
    for (const h of DROP_TO_BACKEND) delete headers[h];
  }
  const out = http.request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  out.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Proxy: ${target.host} nicht erreichbar (${err.message})`);
  });
  req.pipe(out);
});

// websocket of the Expo dev server (reload, logs)
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(Number(EXPO.port), EXPO.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...Object.entries({ ...req.headers, host: EXPO.host }).map(([k, v]) => `${k}: ${v}`)];
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log(`dev-proxy http://localhost:${PORT} → api ${BACKEND.host}, app ${EXPO.host}`));
