// Solmar City — make.fun gta6-01 entry (Node 22, standard library only).
//
// The game lives in this repo's game/ folder: plain static files that a desktop
// browser opens offline (game/index.html and its classic scripts, no library,
// no network request). This program hands the entry in: it copies game/ and
// screenshots/ next to this file into the output directory and writes
// output/dossier.json — the summary the judge reads — using the vendored
// make.fun library. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset, so /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the two folders the entry is made of.
mkdirSync(targetDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(targetDir, 'game'), { recursive: true });
mkdirSync(join(targetDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(targetDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits, so a build that passes here also
// passes the gate: at most 4 screenshots of 256 KiB each, at most 993 files
// and 48 MiB under game/, no path longer than 1000 bytes. Only
// text_max_bytes changes the dossier's bytes; the rest refuse a bad entry.
const dossierText = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(targetDir, 'dossier.json'), dossierText);
