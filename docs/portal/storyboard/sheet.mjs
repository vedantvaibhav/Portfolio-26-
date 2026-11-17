// Contact sheet of every rendered frame, for a quick look.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(path.join(here, 'frames')).filter((f) => f.endsWith('.jpg') && !f.startsWith('_'));
const pick = process.argv.slice(2); const list = pick.length ? pick.map((p) => p + '.jpg') : files;
const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${process.env.COLS || 3},1fr);gap:6px;font:12px monospace;color:#aaa">${list.map((f) => `<div><img src="file://${path.join(here, 'frames', f)}" style="width:100%;display:block"><div style="padding:3px 6px">${f}</div></div>`).join('')}</body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1980, height: 800 } });
const tmp = path.join(here, 'frames', '_sheet.html'); fs.writeFileSync(tmp, html); await p.goto('file://' + tmp); await p.waitForLoadState('networkidle'); fs.unlinkSync(tmp);
await p.screenshot({ path: path.join(here, 'frames', '_sheet.jpg'), type: 'jpeg', quality: 82, fullPage: true });
await b.close();
