/**
 * Generate the PWA icons from the existing brand mark.
 *
 * Renders public/favicon.svg with Chrome at the sizes a web app manifest
 * wants, so the installed icon matches the browser-tab favicon. Writes into
 * public/icons/, which Vite copies to static/icons/ on build.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, "..", "public");
const OUT = path.join(PUBLIC, "icons");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const svg = await fs.readFile(path.join(PUBLIC, "favicon.svg"), "utf8");
const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

function pageHtml(size, { maskable }) {
  const inner = maskable ? Math.round(size * 0.7) : size;
  const background = maskable ? "#17321f" : "transparent";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${background}}
    .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
    img{width:${inner}px;height:${inner}px;display:block}
  </style></head><body><div class="wrap"><img src="${dataUri}" alt=""></div></body></html>`;
}

await fs.mkdir(OUT, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: true },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  for (const target of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: target.size, height: target.size, deviceScaleFactor: 1 });
    await page.setContent(pageHtml(target.size, target), { waitUntil: "load" });
    const buffer = await page.screenshot({ omitBackground: !target.maskable });
    const file = path.join(OUT, target.name);
    await fs.writeFile(file, buffer);
    console.log(`wrote ${path.relative(PUBLIC, file)} (${buffer.length} bytes)`);
    await page.close();
  }
} finally {
  await browser.close();
}
