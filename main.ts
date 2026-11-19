// Neon Heist Canvas — a working gta6-cover-art-01 entry (Node 22, standard library
// only): the app is this directory's app/ folder, plain static files a desktop browser
// loads offline (app/index.html and its ES modules, no library and no network request),
// and the program hands it in. It copies app/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. The cover art itself: a GTA-style poster maker with six
// diagonal/offset layouts, per-panel colour grades, a code-drawn Vice City sunset
// backdrop (gradient sky, striped sun, palm silhouettes — no game artwork, logo or
// font), multi-zone typography (title + subtitle ribbon + tagline + stamp badge),
// film grain and halftone, exporting PNG at 1080x1080, 1080x1350, 1080x1920 and
// 1920x1080. Its two sample photos (app/samples/) were made for make.fun with an image
// model and are free to use. Put your 3 or 4 PNG or JPEG screenshots in screenshots/
// (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outRaw = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Validate the output directory before copying anything: refuse an empty value and
// refuse the repository itself (copying app/ into itself would recurse). A relative
// value is resolved against the working directory, so `MAKEFUN_OUTPUT_DIR=out` works
// for local checks while the grader's absolute /output works too. A bad value fails
// here, loudly, instead of producing a half-built /output the scorer then rejects.
if (!outRaw.trim()) throw new Error('MAKEFUN_OUTPUT_DIR is empty');
const out = isAbsolute(outRaw) ? outRaw : resolve(process.cwd(), outRaw);
if (resolve(out) === resolve(here)) throw new Error('MAKEFUN_OUTPUT_DIR must not be the repository root');
if (!existsSync(join(here, 'app', 'index.html'))) throw new Error('app/index.html is missing from the repository');
if (!existsSync(join(here, 'vendor', 'makefun-app.ts'))) throw new Error('vendor/makefun-app.ts is missing from the repository');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
