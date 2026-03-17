/**
 * Tests for config validation.
 */
const { validateConfig, validatePartial, mergeAndValidate } = require("./config-validator");
const { loadConfig, isValidPort } = require("./config-loader");
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

// ── validateConfig tests ──────────────────────────────────────

console.log("validateConfig:");

(() => {
  const r = validateConfig({ host: "localhost", port: 8080 });
  assert(r.valid === true, "accepts valid minimal config");
})();

(() => {
  const r = validateConfig({ host: "localhost", port: 8080, timeout: 30, logLevel: "info" });
  assert(r.valid === true, "accepts valid full config");
})();

(() => {
  const r = validateConfig({ port: 8080 });
  assert(r.valid === false, "rejects missing host");
})();

(() => {
  const r = validateConfig({ host: "localhost", port: 0 });
  assert(r.valid === false, "rejects port 0");
})();

(() => {
  const r = validateConfig({ host: "localhost", port: 65536 });
  assert(r.valid === false, "rejects port 65536");
})();

(() => {
  const r = validateConfig({ host: "localhost", port: 1 });
  assert(r.valid === true, "accepts port 1 (minimum valid)");
})();

(() => {
  const r = validateConfig({ host: "localhost", port: 65535 });
  assert(r.valid === true, "accepts port 65535 (maximum valid)");
})();

// ── validatePartial tests ─────────────────────────────────────

console.log("\nvalidatePartial:");

(() => {
  const r = validatePartial({ port: 0 });
  assert(r.valid === false, "partial: rejects port 0");
})();

(() => {
  const r = validatePartial({ port: 65536 });
  assert(r.valid === false, "partial: rejects port 65536");
})();

(() => {
  const r = validatePartial({ timeout: 60 });
  assert(r.valid === true, "partial: accepts valid timeout");
})();

// ── config-loader tests ───────────────────────────────────────

console.log("\nconfig-loader:");

(() => {
  assert(isValidPort(0) === false, "loader: rejects port 0");
})();

(() => {
  assert(isValidPort(65536) === false, "loader: rejects port 65536");
})();

(() => {
  assert(isValidPort(8080) === true, "loader: accepts port 8080");
})();

// Test loadConfig with a temp file
(() => {
  const tmpFile = path.join(__dirname, "_test_config.json");
  fs.writeFileSync(tmpFile, JSON.stringify({ host: "localhost", port: 0 }));
  const r = loadConfig(tmpFile);
  fs.unlinkSync(tmpFile);
  assert(r.error !== null, "loader: rejects config with port 0");
})();

(() => {
  const tmpFile = path.join(__dirname, "_test_config.json");
  fs.writeFileSync(tmpFile, JSON.stringify({ host: "localhost", port: 8080 }));
  const r = loadConfig(tmpFile);
  fs.unlinkSync(tmpFile);
  assert(r.config !== null && r.error === null, "loader: accepts valid config");
})();

// ── mergeAndValidate tests ────────────────────────────────────

console.log("\nmergeAndValidate:");

(() => {
  const r = mergeAndValidate({ host: "localhost", port: 8080 }, { port: 0 });
  assert(r.valid === false, "merge: rejects update to port 0");
})();

// ── Summary ───────────────────────────────────────────────────

console.log(`\nResults: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
