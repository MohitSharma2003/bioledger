/**
 * WebGPU / browser-inference check for the optional "Gemma 4 E2B (for mobile)"
 * runtime.
 *
 * Unlike the layout checks, this runs Chrome WITHOUT --disable-gpu, so the
 * WebGPU path is real, not stubbed. It has two levels:
 *
 *   1. Default: probe navigator.gpu for a real adapter and report it. This
 *      confirms the hardware/browser can offer WebGPU. It does NOT claim the
 *      model works, because no weights have been loaded.
 *
 *   2. BIOLEDGER_RUN_INFERENCE=1: drive the running app to actually select the
 *      mobile model, download the ~3.15 GB weights, and record a text-only
 *      sighting, then wait for a real field note. This is the only mode that
 *      verifies end-to-end inference. It is opt-in because it downloads a lot
 *      and takes minutes.
 *
 * Usage:
 *   node scripts/gpu-inference-check.mjs
 *   BIOLEDGER_RUN_INFERENCE=1 node scripts/gpu-inference-check.mjs
 */

import puppeteer from "puppeteer-core";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const RUN_INFERENCE = process.env.BIOLEDGER_RUN_INFERENCE === "1";
// A stable profile keeps the Hugging Face weights in the browser's cache across
// runs, so the first run downloads ~3.2 GB and later runs reuse it.
const PROFILE =
  process.env.BIOLEDGER_PROFILE || path.join(os.tmpdir(), "bioledger-chrome-profile");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: process.env.BIOLEDGER_HEADLESS === "1",
  userDataDir: PROFILE,
  // No --disable-gpu: the whole point is to exercise the real GPU path.
  args: ["--no-sandbox", "--enable-unsafe-webgpu"],
  defaultViewport: { width: 1280, height: 900 },
});

const page = await browser.newPage();
page.on("pageerror", (error) => console.log("[pageerror]", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.log("[page console]", message.text());
});
await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });

const gpu = await page.evaluate(async () => {
  const nav = navigator;
  if (!nav.gpu) return { available: false, reason: "navigator.gpu is undefined" };
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return { available: false, reason: "no adapter returned" };
    const info = adapter.info || (adapter.requestAdapterInfo ? adapter.requestAdapterInfo() : null);
    return { available: true, adapter: info?.description || info?.vendor || "adapter present" };
  } catch (error) {
    return { available: false, reason: String(error && error.message) };
  }
});

console.log("WebGPU available:", gpu.available);
if (gpu.available) console.log("adapter:", gpu.adapter);
else console.log("reason:", gpu.reason);

if (!RUN_INFERENCE) {
  console.log("");
  console.log(
    gpu.available
      ? "GPU path is available. Inference is NOT verified in this mode; set BIOLEDGER_RUN_INFERENCE=1 to load weights and run the model."
      : "No WebGPU adapter: the optional mobile model cannot run on this machine/browser from here.",
  );
  await browser.close();
  process.exitCode = gpu.available ? 0 : 2;
  process.exit();
}

if (!gpu.available) {
  console.log("Cannot run inference without a WebGPU adapter.");
  await browser.close();
  process.exit(2);
}

console.log("");
console.log("RUN_INFERENCE=1: selecting the mobile model and starting the download...");

// Select the optional mobile model in the model menu.
await page.click('button[aria-haspopup="true"]');
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const target = buttons.find((b) => (b.textContent || "").includes("Gemma 4 E2B (for mobile)"));
  target?.click();
});
await new Promise((r) => setTimeout(r, 500));

// Click Download (first run) or Load (weights already cached) on the row.
const started = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const target = buttons.find((b) => /^(Download|Load)\b/.test((b.textContent || "").trim()));
  if (!target) return false;
  target.click();
  return true;
});
if (!started) {
  console.log("FAIL: no Download button appeared for the mobile model.");
  await browser.close();
  process.exit(1);
}

// Poll the open model panel until the row reads ready, or we give up.
const DEADLINE_MS = Number(process.env.BIOLEDGER_INFER_TIMEOUT_MS || 25 * 60 * 1000);
const start = Date.now();
let ready = false;
let lastLog = 0;
while (Date.now() - start < DEADLINE_MS) {
  const state = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.innerText : document.body.innerText;
  });
  // "ready offline" only appears on the mobile row once the model is loaded and
  // verified. The desktop row reads plain "ready", so this cannot false-match.
  if (/ready offline/i.test(state)) {
    ready = true;
    break;
  }
  if (/\b(error|unsupported|out of memory)\b/i.test(state)) {
    console.log("FAIL: the mobile model reported:", state.replace(/\s+/g, " ").slice(0, 200));
    await browser.close();
    process.exit(1);
  }
  const elapsed = Math.round((Date.now() - start) / 1000);
  if (elapsed - lastLog >= 30) {
    lastLog = elapsed;
    const snippet = state.replace(/\s+/g, " ").slice(0, 120);
    console.log(`[${elapsed}s] ${snippet}`);
  }
  await new Promise((r) => setTimeout(r, 3000));
}

if (!ready) {
  console.log("FAIL: the download/initialisation did not reach ready within the timeout.");
  await browser.close();
  process.exit(1);
}
console.log("Model reported ready after", Math.round((Date.now() - start) / 1000), "seconds.");

// The model is loaded in memory now. Do NOT navigate: a reload would drop the
// loaded model (the weights stay cached, but the in-memory object is gone).
// Close the menu and record a text-only sighting on the page we are already on.
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 300));
await page.waitForSelector("textarea#text", { timeout: 10000 });
await page.type("textarea#text", "A small grey bird on the fence, wagging its tail.");
const typed = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const target = buttons.find((b) => (b.textContent || "").includes("Record sighting"));
  if (!target) return false;
  target.click();
  return true;
});
if (!typed) {
  console.log("FAIL: could not submit the sighting.");
  await browser.close();
  process.exit(1);
}

const INFER_DEADLINE = Number(process.env.BIOLEDGER_INFER_REPLY_MS || 8 * 60 * 1000);
const inferStart = Date.now();
let answered = false;
let failureNotice = "";
let sawWriting = false;
while (Date.now() - inferStart < INFER_DEADLINE) {
  const state = await page.evaluate(() => document.body.innerText);
  if (/Writing the note/i.test(state)) sawWriting = true;
  // "Recorded" and "Season" are specimen-only labels; the empty placeholder
  // does not contain them, so this cannot false-match before a note renders.
  if (/\bRecorded\b/i.test(state) && /\bSeason\b/i.test(state)) {
    answered = true;
    const notice = state.match(/(could not finish reading[^.]*|could not read[^.]*|saved as written[^.]*|model was unavailable[^.]*)/i);
    failureNotice = notice ? notice[0] : "";
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

if (!answered) {
  const tail = await page.evaluate(() => document.body.innerText);
  console.log("saw 'Writing the note':", sawWriting);
  console.log("page text tail:", tail.replace(/\s+/g, " ").slice(-700));
}

const ok = answered && !failureNotice;
if (failureNotice) console.log("fallback notice:", failureNotice);
if (ok) {
  const specimen = await page.evaluate(() => {
    const name = document.querySelector(".species-name");
    if (!name) return null;
    const article = name.closest("article");
    const pct = Array.from(article?.querySelectorAll("span") || [])
      .map((s) => (s.textContent || "").trim())
      .find((t) => /^\d{1,3}%$/.test(t));
    return { species: name.textContent?.trim() || "?", pct: pct || "?" };
  });
  console.log("specimen:", JSON.stringify(specimen));
}
console.log("");
console.log(ok ? "PASS: the browser model produced a real field note." : "FAIL: no genuine field note.");
await browser.close();
process.exit(ok ? 0 : 1);
