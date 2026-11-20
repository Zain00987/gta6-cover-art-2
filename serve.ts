// Neon Heist Canvas — local static server (Node 22, standard library only).
//
// Serves this repository's app/ on http://localhost:8080 so the cover maker
// can be tried in desktop Chrome with no build step:
//   node serve.ts            (port 8080)
//   node serve.ts --port 9000
// Only files under app/ are served; anything else is a 404, and any path
// that tries to climb out of app/ is refused. This is a development
// convenience, not a server for the internet.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const flag = process.argv.indexOf('--port');
const wanted = flag === -1 ? NaN : Number(process.argv[flag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function send(response: import('node:http').ServerResponse, code: number, body: string): void {
  response.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

createServer((request, response) => {
  let path = '/';
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    send(response, 400, 'bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(appRoot, normalize(path)));
  if (file !== appRoot && !file.startsWith(appRoot + sep)) {
    send(response, 403, 'forbidden');
    return;
  }
  let size: number;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    send(response, 404, 'not found');
    return;
  }
  response.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Neon Heist Canvas is on http://localhost:${port}`);
});
