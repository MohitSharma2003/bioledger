import puppeteer from "puppeteer-core";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const width = Number(process.env.W || 320);
const route = process.env.ROUTE || "/";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 400));

const offenders = await page.evaluate(() => {
  const de = document.documentElement;
  const limit = de.clientWidth + 1;
  const out = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > limit) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 70),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.textContent || "").trim().slice(0, 30),
      });
    }
  }
  return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, out: out.slice(0, 25) };
});

console.log(`route=${route} width=${width} client=${offenders.clientWidth} scroll=${offenders.scrollWidth}`);
for (const o of offenders.out) {
  console.log(`  right=${o.right} w=${o.width} <${o.tag} class="${o.cls}"> "${o.text}"`);
}
await browser.close();
