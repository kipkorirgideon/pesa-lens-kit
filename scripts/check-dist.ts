/**
 * Post-build guard (TASK-29): fails if any emitted JS asset (including the worker chunk and anything a
 * dependency ships) contains a regex lookbehind, `(?<=` or `(?<!`. Safari < 16.4 cannot parse these and
 * a SyntaxError blanks the whole app. Named groups `(?<name>` are fine on our floor and are not flagged.
 * Node and headless Chromium both accept lookbehind, so no other gate can see this.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOOKBEHIND = /\(\?<[=!]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const root = process.argv[2] ?? 'dist';
const files = walk(root).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
if (files.length === 0) {
  console.error(`check-dist: no JS files under ${root}; did the build run?`);
  process.exit(1);
}
let bad = 0;
for (const f of files) {
  const n = readFileSync(f, 'utf8').match(LOOKBEHIND)?.length ?? 0;
  if (n > 0) {
    console.error(`check-dist: ${f} contains ${n} regex lookbehind(s); unsupported on Safari < 16.4.`);
    bad += n;
  }
}
if (bad > 0) process.exit(1);
console.log(`check-dist: ${files.length} JS files, no regex lookbehind.`);
