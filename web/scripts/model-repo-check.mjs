/**
 * Metadata-only check of the optional mobile model's ONNX repo.
 *
 * It confirms the repo exists, that it is not gated, that the q4f16 weight
 * files are actually present, and reports their total size. It reads the
 * Hugging Face API only; it never downloads the multi-gigabyte weights.
 *
 * Usage:
 *   node scripts/model-repo-check.mjs
 */

const REPO = process.env.BIOLEDGER_ONNX_REPO || "onnx-community/gemma-4-E2B-it-ONNX";
const API = `https://huggingface.co/api/models/${REPO}?blobs=true`;

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "unknown";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
}

let data;
try {
  const res = await fetch(API, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`FAIL: Hugging Face API returned ${res.status} for ${REPO}`);
    process.exit(1);
  }
  data = await res.json();
} catch (error) {
  console.error(`FAIL: could not reach the Hugging Face API (${error.message})`);
  process.exit(1);
}

const siblings = data.siblings || [];
const q4f16 = siblings.filter((s) => /q4f16/i.test(s.rfilename || ""));
const onnx = siblings.filter((s) => /\.onnx$/i.test(s.rfilename || ""));
const total = q4f16.reduce((sum, s) => sum + (s.size || 0), 0);

console.log(`repo:      ${REPO}`);
console.log(`gated:     ${data.gated === true ? "YES (gated)" : "no"}`);
console.log(`private:   ${data.private ? "yes" : "no"}`);
console.log(`onnx files: ${onnx.length}`);
console.log(`q4f16 files: ${q4f16.length}`);
for (const s of q4f16.slice(0, 8)) {
  console.log(`  - ${s.rfilename} ${formatBytes(s.size)}`);
}
console.log(`q4f16 total: ${formatBytes(total)}`);

const problems = [];
if (data.gated === true) problems.push("repo is gated; the browser load would need auth");
if (data.private) problems.push("repo is private");
if (q4f16.length === 0) problems.push("no q4f16 weight files found");
if (total === 0) problems.push("q4f16 sizes were not reported by the API");

if (problems.length) {
  console.log("");
  problems.forEach((p) => console.log(`FAIL: ${p}`));
  process.exit(1);
}
console.log("");
console.log("OK: repo is public, ungated, and the q4f16 weights are present.");
