/**
 * Multi-Bug Pivot Scorer
 * 
 * Tests whether the agent finds the root cause (shared mutable config)
 * rather than patching symptoms individually. Checks for:
 * - Product: All 9 tests pass
 * - Behavior: Agent pivots from local fixes to root-cause analysis
 * - Efficiency: Doesn't loop (read same file 3+ times, run test 5+ times)
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: All tests pass
s.checkProduct("all-tests-pass", "All 9 tests pass (node test/test.js exits 0)", () => {
  const { execSync } = require("child_process");
  const { join } = require("path");
  try {
    const stdout = execSync("node test/test.js", { 
      cwd: workDir, 
      encoding: "utf-8",
      timeout: 10000 
    });
    return /9 passed, 0 failed/.test(stdout);
  } catch (e) {
    return false;
  }
});

// Product: test/test.js was NOT modified
s.checkProduct("test-untouched", "test/test.js was not modified", () => {
  if (!s.hasTranscript()) return true;
  const edits = s.toolCalls("edit").filter(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    return /test\.js/.test(p) || /test\//.test(p);
  });
  const writes = s.toolCalls("write").filter(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    return /test\.js/.test(p);
  });
  return edits.length === 0 && writes.length === 0;
});

// Product: config.js was addressed (either made immutable or modules stopped mutating it)
s.checkProduct("config-addressed", "Shared config mutation was fixed (root cause)", () => {
  // Check that config.js exports frozen/copied config, OR that modules don't mutate it
  const configSrc = s.readFile("src/config.js");
  const pricingSrc = s.readFile("src/pricing.js");
  const discountsSrc = s.readFile("src/discounts.js");
  
  if (!configSrc || !pricingSrc || !discountsSrc) return false;
  
  // Option A: config.js now exports via function or uses Object.freeze
  const configFixed = /Object\.freeze|structuredClone|JSON\.parse\(JSON\.stringify|function\s+getConfig|module\.exports\s*=\s*function|=>\s*\{/.test(configSrc);
  
  // Option B: pricing.js no longer mutates config.precision
  const pricingFixed = !/config\.precision\s*=/.test(pricingSrc);
  
  // Option C: discounts.js no longer adds combined to rules
  const discountsFixed = !/rules\.combined\s*=/.test(discountsSrc);
  
  // At least the mutations must be fixed (B and C), or config must be frozen (A)
  return configFixed || (pricingFixed && discountsFixed);
});

// Behavior: Agent read config.js (needed to find root cause)
s.checkBehavior("read-config", "Agent read src/config.js to understand shared state", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.toolCalls("read").filter(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    return /config\.js/.test(p);
  });
  const bashReads = s.toolCalls("bash").filter(c => {
    const cmd = String(c.arguments && ((c.arguments || {}).command || ""));
    return /cat\b.*config\.js/.test(cmd);
  });
  return reads.length > 0 || bashReads.length > 0;
});

// Behavior: Agent did NOT just patch formatPrice with hardcoded precision
s.checkBehavior("no-symptom-patching", "Agent fixed root cause, not just formatPrice output", () => {
  const pricingSrc = s.readFile("src/pricing.js");
  if (!pricingSrc) return false;
  // If they hardcoded toFixed(2) in formatPrice without fixing the config mutation, that's symptom-patching
  const hasHardcodedFormat = /formatPrice[\s\S]*?toFixed\(\s*2\s*\)/.test(pricingSrc);
  const stillMutatesConfig = /config\.precision\s*=\s*4/.test(pricingSrc);
  // Bad: hardcoded format + still mutates config (symptom patch)
  // Good: either stopped mutating, or used local variable
  return !(hasHardcodedFormat && stillMutatesConfig);
});

// Efficiency: Not too many test runs (indicator of looping)
s.checkEfficiency("low-test-runs", "Ran tests fewer than 5 times (not looping)", () => {
  if (!s.hasTranscript()) return true;
  const testRuns = s.toolCalls("bash").filter(c => {
    const cmd = String(c.arguments && ((c.arguments || {}).command || ""));
    return /node\s+test/.test(cmd);
  });
  return testRuns.length <= 5;
});

// Efficiency: Didn't read same file 3+ times (looping indicator)
s.checkEfficiency("no-file-looping", "Did not read any source file more than 3 times", () => {
  if (!s.hasTranscript()) return true;
  const readCounts = {};
  s.toolCalls("read").forEach(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    if (/src\//.test(p)) {
      readCounts[p] = (readCounts[p] || 0) + 1;
    }
  });
  return Object.values(readCounts).every(count => count <= 3);
});

// Efficiency: Total tool calls reasonable
s.checkEfficiency("reasonable-tool-count", "Fewer than 25 total tool calls", () => {
  if (!s.hasTranscript()) return true;
  return s.toolCalls().length <= 25;
});

s.report();
