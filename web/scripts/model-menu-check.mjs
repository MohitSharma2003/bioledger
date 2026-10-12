/**
 * Smoke-checks the model control: opens the panel, confirms the two distinct
 * options and their roles render, switches to the optional mobile model
 * without downloading, and confirms the choice persists.
 * Does not trigger a model download.
 */

import puppeteer from "puppeteer-core";

const BASE = (process.env.BIOLEDGER_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 850, deviceScaleFactor: 1 });
await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 500));

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const triggerBefore = await page.evaluate(() => document.querySelector('button[aria-haspopup="true"]')?.textContent || "");
console.log("default trigger:", triggerBefore.trim());
if (!triggerBefore.includes("Gemma3:4B")) fail("default model is not Gemma3:4B");

await page.click('button[aria-haspopup="true"]');
await new Promise((r) => setTimeout(r, 250));
const menu = await page.evaluate(
  () => document.querySelector('[role="dialog"]')?.textContent || "",
);
console.log("panel shows desktop model:", menu.includes("Gemma3:4B"));
console.log("panel shows mobile model:", menu.includes("Gemma 4 E2B (for mobile)"));
console.log("panel shows roles:", menu.includes("Default · This computer · Ollama") && menu.includes("Optional · Browser-local inference"));
if (!menu.includes("Gemma3:4B")) fail("desktop model name missing");
if (!menu.includes("Gemma 4 E2B (for mobile)")) fail("mobile model name missing");
if (!menu.includes("Default · This computer · Ollama")) fail("desktop subtitle missing");
if (!menu.includes("Optional · Browser-local inference")) fail("mobile subtitle missing");
if (/Qwen2\.5|SmolLM2/.test(menu)) fail("old multi-model options still present");

const optionCount = await page.evaluate(
  () => document.querySelectorAll('[role="dialog"] button[aria-pressed]').length,
);
console.log("model option count:", optionCount);
if (optionCount !== 2) fail(`expected exactly 2 model options, saw ${optionCount}`);

// Select the optional mobile model without downloading.
const selected = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const target = buttons.find((b) => (b.textContent || "").includes("Gemma 4 E2B (for mobile)"));
  if (!target) return false;
  target.click();
  return true;
});
if (!selected) fail("could not select the mobile model");
await new Promise((r) => setTimeout(r, 700));

const stored = await page.evaluate(() => localStorage.getItem("bioledger.model"));
console.log("persisted selection:", stored);
if (!stored || !stored.startsWith("browser:onnx-community/gemma-4-E2B-it-ONNX")) {
  fail("selection not persisted as the browser mobile model");
}

const trigger = await page.evaluate(() => document.querySelector('button[aria-haspopup="true"]')?.textContent || "");
console.log("trigger now:", trigger.trim());
if (!trigger.includes("Gemma 4 E2B (for mobile)")) fail("trigger did not show the selected model");

// Switch back to the desktop default and confirm the Ollama path returns.
const hasDialog = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
if (!hasDialog) {
  await page.click('button[aria-haspopup="true"]');
  await new Promise((r) => setTimeout(r, 250));
}
const back = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const target = buttons.find((b) => (b.textContent || "").includes("Gemma3:4B"));
  if (!target) return false;
  target.click();
  return true;
});
if (!back) fail("could not switch back to Gemma3:4B");
await new Promise((r) => setTimeout(r, 700));
const storedBack = await page.evaluate(() => localStorage.getItem("bioledger.model"));
console.log("persisted after switch back:", storedBack);
if (!storedBack || !storedBack.startsWith("ollama:gemma3:4b")) {
  fail("switch back did not restore the desktop Ollama model");
}
const triggerBack = await page.evaluate(() => document.querySelector('button[aria-haspopup="true"]')?.textContent || "");
if (!triggerBack.includes("Gemma3:4B")) fail("trigger did not return to Gemma3:4B");

await browser.close();
console.log(process.exitCode ? "model menu check FAILED" : "model menu check passed");
