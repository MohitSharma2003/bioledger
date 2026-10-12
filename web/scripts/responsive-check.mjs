/**
 * Responsive layout check for Bioledger.
 *
 * Drives the system Chrome against a running server and, at each target
 * width and route, reports (a) horizontal overflow and (b) the smallest
 * visible interactive control. Overflow is a hard failure; the touch-target
 * number is reported for review.
 *
 * Usage:
 *   node scripts/responsive-check.mjs
 *   BIOLEDGER_URL=http://127.0.0.1:8002 CHROME_PATH=... node scripts/responsive-check.mjs
 */

import puppeteer from "puppeteer-core";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const WIDTHS = [320, 360, 375, 390, 412, 768, 1024, 1440];
const ROUTES = ["/", "/sightings", "/ask", "/ledger", "/season"];
const MIN_TOUCH = 44;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const page = await browser.newPage();
const problems = [];
const touch = [];

function fmt(ok) {
  return ok ? "ok  " : "FAIL";
}

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 350));

    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const nodes = Array.from(
        document.querySelectorAll(
          "button, [role=button], input, select, textarea, a.inline-flex",
        ),
      );
      let smallest = null;
      for (const el of nodes) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (rect.width === 0 && rect.height === 0) continue;
        const edge = Math.min(rect.width, rect.height);
        if (!smallest || edge < smallest.edge) {
          smallest = {
            edge: Math.round(edge),
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32),
          };
        }
      }
      return { overflow, smallest };
    });

    const overflowOk = metrics.overflow <= 1;
    if (!overflowOk) {
      problems.push(`${width}px ${route} overflow=${metrics.overflow}px`);
    }
    console.log(
      `${fmt(overflowOk)} ${String(width).padStart(4)}px  ${route.padEnd(11)}  overflow=${String(
        metrics.overflow,
      ).padStart(3)}  minTarget=${metrics.smallest ? metrics.smallest.edge : "-"}` +
        (metrics.smallest && metrics.smallest.edge < MIN_TOUCH
          ? `  (${metrics.smallest.tag}: ${metrics.smallest.label})`
          : ""),
    );
    if (metrics.smallest && metrics.smallest.edge < MIN_TOUCH) {
      touch.push(`${width}px ${route}: ${metrics.smallest.edge}px ${metrics.smallest.tag} "${metrics.smallest.label}"`);
    }
  }
}

await browser.close();

console.log("");
console.log(`Horizontal-overflow failures: ${problems.length}`);
problems.forEach((p) => console.log(`  - ${p}`));
console.log(`Touch targets under ${MIN_TOUCH}px: ${touch.length}`);
touch.forEach((t) => console.log(`  - ${t}`));

process.exit(problems.length ? 1 : 0);
