/**
 * PWA check: is the deployed site installable, and does the app shell work
 * offline once the service worker is running?
 *
 * Run against a built + running server (the default :8002):
 *   node scripts/pwa-check.mjs
 */

import puppeteer from "puppeteer-core";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });

  const client = await page.target().createCDPSession();
  await client.send("Page.enable");

  // 1. Manifest is discoverable and free of errors.
  const manifest = await client.send("Page.getAppManifest").catch(() => ({ url: "", errors: [] }));
  check("manifest is linked", Boolean(manifest.url), manifest.url || "no manifest");
  const manifestErrors = (manifest.errors || []).filter((e) => e.critical || e.severity === "error");
  check("manifest has no errors", manifestErrors.length === 0, manifestErrors.map((e) => e.message).join("; "));

  // 2. Chrome considers the page installable.
  const installability = await client
    .send("Page.getInstallabilityErrors")
    .catch(() => ({ installabilityErrors: [{ errorId: "unsupported" }] }));
  const errors = installability.installabilityErrors || [];
  check("installable (no install errors)", errors.length === 0, errors.map((e) => e.errorId).join(", "));

  // 3. The service worker registers and takes control.
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    try {
      const reg = await navigator.serviceWorker.ready;
      return { supported: true, active: Boolean(reg.active), scope: reg.scope };
    } catch (error) {
      return { supported: true, active: false, error: String(error && error.message) };
    }
  });
  check("service worker is active", sw.supported && sw.active, sw.scope || sw.error || "");

  // 4. Offline: a fresh navigation to a client route still gets the app shell.
  await page.setOfflineMode(true);
  let offlineOk = false;
  let offlineNote = "";
  try {
    await page.goto(BASE + "/ledger", { waitUntil: "domcontentloaded", timeout: 15000 });
    const text = await page.evaluate(() => document.body.innerText);
    offlineOk = /Bioledger/.test(text);
    offlineNote = offlineOk ? "app shell served offline" : "loaded, but no app text";
  } catch (error) {
    offlineNote = String(error && error.message);
  }
  await page.setOfflineMode(false);
  check("app shell loads offline", offlineOk, offlineNote);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log("");
console.log(failed === 0 ? "PWA OK" : `PWA FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
