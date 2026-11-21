// Neon Heist Canvas — a working gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder: plain static files a desktop browser loads offline
// (app/index.html and its ES modules, no library and no network request). The program hands it in:
// it copies app/ and screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// The app itself is an interactive GTA-style cover studio: the user's photos become a slanted
// multi-panel poster with a pop-out hero panel, cast role tags, a giant chrome retro-striped title,
// a 5-star quote bar, a tagline strip, a billing block with barcode and seal, 7 layouts, 6 sunset
// grades, per-panel pan/zoom/flip, a "Surprise me" random poster, and PNG export in 4 sizes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Input validation: refuse a blank output dir, and refuse to build a dossier from
// a screenshots folder that holds nothing or more than the scorer's cap of 4 images.
// A relative MAKEFUN_OUTPUT_DIR is resolved against the working directory.
if (out.trim() === '') {
  throw new Error('MAKEFUN_OUTPUT_DIR must not be blank');
}
const outAbs = out.startsWith('/') ? out : join(process.cwd(), out);
const shotDir = join(here, 'screenshots');
const shotCount = existsSync(shotDir)
  ? (await import('node:fs')).readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).length
  : 0;
if (shotCount === 0) throw new Error('screenshots/: no PNG or JPEG renders to hand in');
if (shotCount > 4) throw new Error(`screenshots/: ${shotCount} images, over the 4 the scorer allows`);

mkdirSync(outAbs, { recursive: true });
cpSync(join(here, 'app'), join(outAbs, 'app'), { recursive: true });
mkdirSync(join(outAbs, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(outAbs, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(outAbs, 'dossier.json'),
  buildDossier(outAbs, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
