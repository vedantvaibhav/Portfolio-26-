// Renders storyboard stills from frames.html into ./frames.
// Usage: node docs/portal/storyboard/render.mjs [frame ids...]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const all = ['arrival', 'drawing', 'fail-open', 'fail-shape', 'snap', 'ignition', 'opening-early', 'opening-late', 'destination', 'planet-dusk', 'planet-bone', 'planet-marigold'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
for (const id of ids) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(id, 'ERROR', e.message));
  await page.goto(`${pathToFileURL(path.join(here, 'frames.html'))}?f=${id}`);
  await page.waitForFunction(() => document.title === 'READY' || document.title === 'ERR', null, { timeout: 120000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(here, 'frames', `${id}.jpg`), type: 'jpeg', quality: 88 });
  console.log(id, await page.title());
  await page.close();
}
await browser.close();
