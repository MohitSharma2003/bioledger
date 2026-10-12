/**
 * Capture real screenshots of the running app into ../docs for the DEV post.
 *
 * Usage:
 *   node scripts/capture-shots.mjs
 *   BIOLEDGER_URL=http://127.0.0.1:8002 node scripts/capture-shots.mjs
 */

import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });

const shots = [
  { route: "/", file: "01-record-a-sighting.png" },
  { route: "/sightings", file: "02-sightings.png" },
  { route: "/ledger", file: "03-ledger.png" },
  { route: "/season", file: "04-in-season.png" },
  { route: "/ask", file: "05-ask-journal.png" },
];

for (const shot of shots) {
  await page.goto(BASE + shot.route, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  const target = path.join(OUT, shot.file);
  await page.screenshot({ path: target, fullPage: false });
  console.log("saved", target);
}

await browser.close();
console.log("done");
