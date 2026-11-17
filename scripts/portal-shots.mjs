// Screenshots of the Portal entry for milestone reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m0          writes docs/portal/shots/m0/*.png
//   pnpm portal:shots m0 http://localhost:3001
//
// Prints the FPS meter reading for each viewport. Headless Chromium renders
// WebGL in software here, so treat that number as a smoke test, not a result.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "latest";
const base = process.argv[3] ?? "http://localhost:3000";
const out = path.join("docs", "portal", "shots", label);
fs.mkdirSync(out, { recursive: true });

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let failed = false;
for (const { name, ...options } of viewports) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  await page.goto(`${base}/?debug`, { waitUntil: "networkidle" });
  const meter = page.locator("[data-portal-fps]");
  await meter.waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const reading = (await meter.innerText()).replace(/\s+/g, " ");
  await page.screenshot({ path: path.join(out, `${name}-debug.png`) });

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${name}.png`) });

  console.log(`${name}: ${reading}${errors.length ? `\n  errors: ${errors.join(" | ")}` : ""}`);
  if (errors.length) failed = true;
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
