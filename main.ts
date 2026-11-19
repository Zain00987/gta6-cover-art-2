// Neon Heist Canvas — the entrypoint (Node 22, standard library only).
//
// The app is app/: plain static files a desktop browser loads offline —
// index.html plus its ES modules, no library, no network request. This program
// hands it in: it copies app/ and screenshots/ from beside this file into the
// output directory and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// The poster itself is an SVG studio: layouts are JSON specs of clip-path
// polygons, grades are SVG filters, the Vice City sunset is code-drawn shapes,
// and the export serialises the live SVG to PNG. Serve it locally with
// `node serve.ts`, then open http://localhost:8080. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const rawOut = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Refuse a useless output directory before touching anything: an empty value,
// or the repository itself (copying app/ into itself would recurse forever).
if (!rawOut.trim()) throw new Error('MAKEFUN_OUTPUT_DIR is empty');
const out = isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
if (resolve(out) === resolve(here)) throw new Error('MAKEFUN_OUTPUT_DIR must not be the repository root');

// The two things the hand-in cannot do without.
for (const needed of ['app/index.html', 'vendor/makefun-app.ts', 'app/src/poster.js']) {
  if (!existsSync(join(here, needed))) throw new Error(`${needed} is missing from the repository`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files in all, or a path under app/ over 1000 bytes.
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

// A hand-in that silently dropped a file is worse than a loud failure, so
// check the copy landed: dossier.json exists and is non-empty, and every
// screenshot made it across at its full size.
const shotNames = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')).filter((n) => /\.(png|jpe?g)$/i.test(n)) : [];
for (const name of shotNames) {
  const copied = join(out, 'screenshots', name);
  const source = join(here, 'screenshots', name);
  if (!existsSync(copied) || statSync(copied).size === 0) throw new Error(`screenshots/${name} did not copy to the output`);
  if (statSync(copied).size !== statSync(source).size) throw new Error(`screenshots/${name} copied short (${statSync(copied).size} of ${statSync(source).size} bytes)`);
}
const dossier = join(out, 'dossier.json');
if (!existsSync(dossier) || statSync(dossier).size === 0) throw new Error('dossier.json was not written');
const appFiles = readdirSync(join(out, 'app'), { recursive: true }).length;
console.log(`Neon Heist Canvas handed in: ${appFiles} app entries, ${shotNames.length} screenshot(s), dossier.json (${statSync(dossier).size} bytes) written to ${out}`);
