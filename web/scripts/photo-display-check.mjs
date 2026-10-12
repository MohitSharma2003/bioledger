/**
 * Confirms a persisted observation photo actually renders in the UI.
 *
 * Opens a sighting that has a photo_url, opens its detail dialog, and checks
 * that an <img> pointing at /api/photos/ loaded successfully (naturalWidth>0).
 *
 * Usage:
 *   node scripts/photo-display-check.mjs
 */

import puppeteer from "puppeteer-core";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });

// Find a stored observation that has a photo.
const rows = await page.evaluate(async () => {
  const res = await fetch("/api/observations?limit=100");
  return res.json();
});

const photoIndex = rows.findIndex((r) => r.photo_url);
if (photoIndex < 0) {
  console.log("NO PHOTO: no observation with a photo_url was found.");
  await browser.close();
  process.exit(0);
}
const withPhoto = rows[photoIndex];
console.log("using observation", withPhoto.id, withPhoto.photo_url, "row index", photoIndex);

await page.goto(BASE + "/sightings", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 500));

const opened = await page.evaluate((index) => {
  const buttons = Array.from(document.querySelectorAll("li button"));
  const target = buttons[index];
  if (!target) return false;
  target.click();
  return true;
}, photoIndex);
if (!opened) {
  console.log("FAIL: could not open the sighting row.");
  await browser.close();
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const img = Array.from(document.querySelectorAll("img")).find((i) =>
    (i.getAttribute("src") || "").includes("/api/photos/"),
  );
  return img ? { found: true, src: img.src, width: img.naturalWidth } : { found: false };
});

console.log("image found:", result.found, result.src || "", "naturalWidth=", result.width);
await browser.close();
if (!result.found || !result.width) {
  console.log("FAIL: the stored photo did not render.");
  process.exit(1);
}
console.log("PASS: the stored photo rendered in the detail view.");
