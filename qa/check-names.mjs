// Scans the app source for name strings that match a real cricketer's surname.
// Usage: node qa/check-names.mjs [dir]   (default: ./src, falls back to repo root)
// Exits 1 if any match is found, so it can run in CI.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { REAL_SURNAMES } from './real-surnames.mjs';

const root = process.argv[2] ?? (existsSync('src') ? 'src' : '.');
const SKIP = new Set(['node_modules', '.git', 'qa', 'dist', 'build']);
const EXTS = new Set(['.js', '.mjs', '.ts', '.jsx', '.tsx', '.json', '.html']);
const banned = new Set(REAL_SURNAMES);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXTS.has(extname(p))) yield p;
  }
}

const hits = [];
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Only look at string literals shaped like a name ("Root", "Joe Root"), so UI
    // text such as "Chase 150" or "Head to head" is not flagged.
    for (const [, str] of line.matchAll(/["'`]([^"'`]{2,60})["'`]/g)) {
      if (!/^[A-Z][a-zA-Z'-]+( [A-Z][a-zA-Z'-]+){0,2}$/.test(str)) continue;
      for (const word of str.toLowerCase().split(/[^a-z]+/)) {
        if (banned.has(word)) hits.push(`${file}:${i + 1}  "${str}"  (matches real surname "${word}")`);
      }
    }
  });
}

if (hits.length) {
  console.log(`Found ${hits.length} name(s) matching real cricketers:\n` + hits.join('\n'));
  process.exit(1);
}
console.log('No real cricketer surnames found.');
