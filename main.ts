// COSTA PALMERA — hand-in entrypoint.
//
// The game itself is a self-contained bundle of static files living in the
// game/ folder beside this script; a desktop browser can open it offline and
// play without any build step or network access. This file is the delivery
// mechanism for the entry: it stages a copy of that game, together with the
// entry's screenshots, into the output directory the grader reads from, and
// then produces dossier.json there — the summary manifest the judge uses to
// see what was handed in.
//
// Typical runs, from the repository root:
//   node main.ts                          -> stages into /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts   -> stages into ./out instead

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Folder this entrypoint sits in; every relative path below hangs off it.
const homeDir = fileURLToPath(new URL('.', import.meta.url));

// Staging destination: the grader's folder, or the caller's override.
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function makeDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function copyTree(folderName: string): void {
  cpSync(join(homeDir, folderName), join(targetDir, folderName), {
    recursive: true,
  });
}

// The game is the payload, so it is staged unconditionally.
makeDir(targetDir);
copyTree('game');

// The screenshots folder always exists in the staging area; when the entry
// ships screenshots of its own they are copied across as well.
const shotsTarget = join(targetDir, 'screenshots');
makeDir(shotsTarget);
if (existsSync(join(homeDir, 'screenshots'))) {
  copyTree('screenshots');
}

// Size and count limits below are the competition's own caps for an entry:
// dossier text budget, screenshot count and per-shot size, and the bounds on
// how large the staged game tree may grow.
const manifest = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

const manifestPath = join(targetDir, 'dossier.json');
writeFileSync(manifestPath, manifest);

console.log(`COSTA PALMERA hand-in ready: dossier written to ${manifestPath}`);
