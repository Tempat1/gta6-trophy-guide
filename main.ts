// GTA VI Trophy Guide — a make.fun entry for gta6-trophy-guide-01: the complete guide to all 55
// PlayStation 5 trophies in Grand Theft Auto VI (1 Platinum, 2 Gold, 6 Silver, 46 Bronze), with
// official descriptions, how-to-unlock tips, a Platinum roadmap, a Next Up list, filters, a
// spoiler setting, and a checklist tracker that saves progress in the browser. The guide itself is
// the static app/ folder beside this file (index.html, style.css, app.js, data/trophies.json —
// ES modules, CSS, no build step, fully offline). This program hands it in: it copies app/ and
// screenshots/ from beside this file to the output directory and writes dossier.json, the summary
// the judge reads, with the vendored make.fun library. Leave vendor/makefun-frontend.ts as it is:
// the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
