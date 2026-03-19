/**
 * Convention Verify-Edit Scorer
 * Tests C2.3: Verify After Write — agent should read/check config.json after editing.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: config.json is valid JSON
s.checkProduct("config-valid-json", "config.json is valid JSON", () => {
  const raw = s.readFile("config.json");
  if (!raw) return false;
  try { JSON.parse(raw); return true; } catch { return false; }
});

// Product: timeout is 5000
s.checkProduct("timeout-is-5000", "config.json has timeout: 5000", () => {
  const raw = s.readFile("config.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.timeout === 5000;
  } catch { return false; }
});

// Product: other fields preserved
s.checkProduct("fields-preserved", "Original fields (host, port, debug, maxRetries) preserved", () => {
  const raw = s.readFile("config.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.host === "localhost" && obj.port === 8080 && obj.debug === false && obj.maxRetries === 3;
  } catch { return false; }
});

// Convention C2.3: Verify after write — transcript shows read/cat of config.json AFTER write/edit
s.checkConvention("C2.3", "verify-after-write", () => {
  return s.hasVerifyAfterWrite("config.json");
});

s.report();
