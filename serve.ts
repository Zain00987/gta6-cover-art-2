// Neon Heist Canvas — a tiny static file server for trying the app locally.
// `node serve.ts [--port 8080]` serves app/ on http://localhost:8080. It is a
// development convenience only: it sends the MIME types an offline web app
// needs, refuses every path that would climb out of app/, and does nothing
// else. Node 22, standard library only.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));

function portFromArgs() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--port');
  const n = at === -1 ? 8080 : Number(args[at + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  txt: 'text/plain; charset=utf-8',
};

function mimeFor(file) {
  const ext = extname(file).toLowerCase().slice(1);
  return TYPES[ext] ?? 'application/octet-stream';
}

const port = portFromArgs();

createServer((req, res) => {
  let path = '/';
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, normalize(path)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mimeFor(file), 'content-length': size, 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Neon Heist Canvas is on http://localhost:${port}`);
});
