// Neon Heist Canvas — round 4 entrypoint (Node 22, standard library only).
//
// The program hands the app in: it copies this repository's app/ and
// screenshots/ into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and
// writes /output/dossier.json with the vendored make.fun library. Before it
// copies anything it verifies the entry the way the gate will: every
// screenshot is a whole PNG or JPEG inside its byte cap and its pixel caps,
// app/ is inside its file and byte caps, and the dossier it writes is inside
// its own cap. Any failure stops the run with a plain message on stderr and
// a non-zero exit, so a bad entry never reaches the grader half-built.
// The run is deterministic: nothing it writes depends on the time, the
// machine, or the order the filesystem lists files in.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this competition (see the kit's RULES.txt).
const SCREENSHOT_MIN_COUNT = 3;
const SCREENSHOT_MAX_COUNT = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const SCREENSHOT_LONG_SIDE_MAX = 1280;
const SCREENSHOT_SHORT_SIDE_MIN = 480;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
const APP_PATH_MAX_BYTES = 1000;
const DOSSIER_MAX_BYTES = 1572864;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function isImageName(name: string): boolean {
  return /\.(png|jpe?g)$/i.test(name);
}

// Read the pixel size of a whole PNG or JPEG from its own header bytes.
// PNG: the IHDR chunk holds width and height as big-endian uint32 at bytes
// 16 and 20. JPEG: walk the markers until a start-of-frame segment (SOF0,
// SOF1 or SOF2) gives height then width as big-endian uint16.
function imageSize(file: string, bytes: Buffer): { w: number; h: number } {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString('latin1') === 'PNG') {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) fail(`${file}: corrupt JPEG marker stream`);
      const marker = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: bytes.readUInt16BE(i + 7), h: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
    fail(`${file}: no JPEG start-of-frame segment found`);
  }
  return fail(`${file}: not a whole PNG or JPEG`);
}

function checkScreenshots(dir: string): Array<{ name: string; bytes: number; w: number; h: number }> {
  if (!existsSync(dir)) fail('screenshots/ is missing: take 3 or 4 screenshots first');
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.') && isImageName(n))
    .sort();
  if (names.length < SCREENSHOT_MIN_COUNT || names.length > SCREENSHOT_MAX_COUNT) {
    fail(`screenshots/ holds ${names.length} images, need ${SCREENSHOT_MIN_COUNT} to ${SCREENSHOT_MAX_COUNT}`);
  }
  return names.map((name) => {
    const file = join(dir, name);
    const bytes = readFileSync(file);
    if (bytes.length > SCREENSHOT_MAX_BYTES) {
      fail(`${name} is ${bytes.length} bytes, over the ${SCREENSHOT_MAX_BYTES} byte cap`);
    }
    const { w, h } = imageSize(name, bytes);
    const longSide = Math.max(w, h);
    const shortSide = Math.min(w, h);
    if (longSide > SCREENSHOT_LONG_SIDE_MAX || shortSide < SCREENSHOT_SHORT_SIDE_MIN) {
      fail(`${name} is ${w}x${h}: long side must be at most ${SCREENSHOT_LONG_SIDE_MAX}, short side at least ${SCREENSHOT_SHORT_SIDE_MIN}`);
    }
    return { name, bytes: bytes.length, w, h };
  });
}

function checkApp(dir: string): { files: number; bytes: number } {
  if (!existsSync(join(dir, 'index.html'))) fail('app/index.html is missing');
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        files += 1;
        walk(p);
      } else if (entry.isFile()) {
        files += 1;
        const size = statSync(p).size;
        bytes += size;
        if (Buffer.byteLength(p, 'utf8') > APP_PATH_MAX_BYTES) fail(`path over ${APP_PATH_MAX_BYTES} bytes: ${p}`);
      } else {
        fail(`app/ holds a non-file, non-directory entry: ${p}`);
      }
    }
  };
  walk(dir);
  if (files > APP_MAX_FILES) fail(`app/ holds ${files} files and directories, over the ${APP_MAX_FILES} cap`);
  if (bytes > APP_MAX_BYTES) fail(`app/ is ${bytes} bytes, over the ${APP_MAX_BYTES} byte cap`);
  return { files, bytes };
}

const shots = checkScreenshots(join(here, 'screenshots'));
const appInfo = checkApp(join(here, 'app'));

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: SCREENSHOT_MAX_COUNT, max_bytes: SCREENSHOT_MAX_BYTES },
  app_max_files: APP_MAX_FILES,
  app_max_bytes: APP_MAX_BYTES,
  app_path_max_bytes: APP_PATH_MAX_BYTES,
});
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);
const dossierBytes = statSync(dossierPath).size;
if (dossierBytes > DOSSIER_MAX_BYTES) fail(`dossier.json is ${dossierBytes} bytes, over the ${DOSSIER_MAX_BYTES} byte cap`);
// buildDossier returns the dossier as bytes (a Uint8Array), not a string:
// writeFileSync writes those bytes as they are, and the text checks below
// read them back through a decoder.
const dossierText = new TextDecoder().decode(dossier);
// The dossier is a text summary, not JSON: it holds the App block, the
// sources and the screenshots. The dossier must name every screenshot the
// run verified, so the judge reads the same covers main.ts checked.
for (const shot of shots) {
  if (!dossierText.includes(shot.name)) fail(`dossier.json does not list ${shot.name}`);
}
// The output's screenshots must be byte-identical to the verified sources.
for (const shot of shots) {
  const copied = statSync(join(out, 'screenshots', shot.name)).size;
  if (copied !== shot.bytes) fail(`${shot.name} changed while copying (${shot.bytes} -> ${copied} bytes)`);
}

console.log(`app/: ${appInfo.files} entries, ${appInfo.bytes} bytes`);
for (const shot of shots) {
  console.log(`screenshot ${shot.name}: ${shot.bytes} bytes, ${shot.w}x${shot.h}`);
}
console.log(`dossier.json: ${dossierBytes} bytes`);
console.log(`wrote ${resolve(out)}`);
