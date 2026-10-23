// Headless mobile smoke test. Serves a folder, opens it at phone size, taps
// random visible buttons, and reports console errors, uncaught exceptions and
// horizontal overflow. Usage: node qa/smoke.mjs [dir] [taps]
// Needs playwright, either in the project or installed globally.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Use a local playwright if the project has one, else the global install.
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium } = playwright;

const dir = process.argv[2] ?? '.';
const taps = Number(process.argv[3] ?? 300);
const PHONE_WIDTH = 375;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(dir, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'text/html' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: PHONE_WIDTH, height: 667 }, isMobile: true, hasTouch: true });
page.on('console', m => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
page.on('pageerror', e => problems.push(`uncaught: ${e.message}`));
await page.goto(url);

// Reported once. A page without <meta name="viewport"> lays out at 980px and fails here too.
let overflowSeen = false;
const checkOverflow = async label => {
  if (overflowSeen) return;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width > PHONE_WIDTH + 1) {
    overflowSeen = true;
    problems.push(`horizontal overflow on ${label}: ${width}px > ${PHONE_WIDTH}px`);
  }
};
await checkOverflow('first screen');

for (let i = 0; i < taps; i++) {
  const buttons = await page.locator('button:visible, [role=button]:visible, a:visible').all();
  const enabled = [];
  for (const b of buttons) if (await b.isEnabled().catch(() => false)) enabled.push(b);
  if (!enabled.length) break;
  const b = enabled[Math.floor(Math.random() * enabled.length)];
  const text = (await b.innerText().catch(() => '')).trim().slice(0, 30);
  await b.tap({ timeout: 2000 }).catch(() => {});
  await checkOverflow(`after tap ${i} ("${text}")`);
}
await page.screenshot({ path: new URL('./last-smoke.png', import.meta.url).pathname, fullPage: true });
await browser.close();
server.close();

const unique = [...new Set(problems)];
console.log(unique.length ? `Problems found:\n- ${unique.join('\n- ')}` : 'Smoke test clean.');
process.exit(unique.length ? 1 : 0);
