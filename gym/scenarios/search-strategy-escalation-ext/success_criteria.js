/**
 * Success Criteria for "search-strategy-escalation"
 *
 * Tests PRODUCT (correct fix) and PROCESS (efficient search):
 *
 * Product:
 *   1. rate-limiter.js reads maxRequests (not .max)
 *   2. Tests pass (node test/rate-limit-test.js exits 0)
 *
 * Process (Search-Strategy Skill):
 *   SSE-1: Agent used fewer than 10 grep/find/rg commands total
 *   SSE-2: Agent read at least one file after searching (didn't just grep endlessly)
 *   SSE-3: Agent read the rate-limiter.js file (the actual bug location)
 *   SSE-4: Agent read the config file (to understand the mismatch)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const transcriptPath = process.argv[3] || path.join(process.argv[2] || '.', 'transcript.jsonl');

const results = {
  scenario: 'search-strategy-escalation',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, category, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, message: result.detail, category });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, message: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Product Checks ─────────────────────────────────────────────────────

check('fix-applied', 'product', () => {
  const filePath = path.join(envDir, 'src/middleware/rate-limiter.js');
  if (!fs.existsSync(filePath)) return { passed: false, detail: 'rate-limiter.js not found' };
  const content = fs.readFileSync(filePath, 'utf8');
  const usesMaxRequests = content.includes('maxRequests');
  const stillUsesDotMax = /config\.rateLimit\.max[^R]/.test(content) || 
                           /config\.rateLimit\.max\b(?!Requests)/.test(content);
  return {
    passed: usesMaxRequests && !stillUsesDotMax,
    detail: usesMaxRequests && !stillUsesDotMax
      ? 'rate-limiter.js correctly reads maxRequests'
      : `usesMaxRequests=${usesMaxRequests}, stillUsesDotMax=${stillUsesDotMax}`
  };
});

check('tests-pass', 'product', () => {
  try {
    execSync(`node test/rate-limit-test.js`, { cwd: envDir, timeout: 10000 });
    return { passed: true, detail: 'All tests pass' };
  } catch (err) {
    return { passed: false, detail: `Tests failed: ${err.stdout?.toString().slice(-200) || err.message}` };
  }
});

// ── Process Checks (Search Efficiency) ─────────────────────────────────

check('search-count-under-10', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  // Count grep/find/rg commands in bash calls
  const searchCommands = transcript.match(/\b(grep|find|rg|ag)\b/g);
  const count = searchCommands ? searchCommands.length : 0;
  
  return {
    passed: count < 10,
    detail: `Found ${count} search commands (threshold: <10)`
  };
});

check('reads-file-after-search', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  // Check that agent used read() or cat on files (not just grepped)
  const hasRead = /"tool"\s*:\s*"read"/.test(transcript) || 
                  /\bread\(/.test(transcript) ||
                  /\bcat\b.*\.js/.test(transcript);
  
  return {
    passed: hasRead,
    detail: hasRead ? 'Agent read files after searching' : 'No file reads detected — agent may have only grepped'
  };
});

check('reads-rate-limiter', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  const readsRateLimiter = /rate-limiter/.test(transcript);
  
  return {
    passed: readsRateLimiter,
    detail: readsRateLimiter ? 'Agent examined rate-limiter.js' : 'No evidence of reading rate-limiter.js'
  };
});

check('reads-config', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  const readsConfig = /defaults\.js|config\/index\.js|config\/defaults/.test(transcript);
  
  return {
    passed: readsConfig,
    detail: readsConfig ? 'Agent examined config files' : 'No evidence of reading config files'
  };
});

// ── Compute final result ───────────────────────────────────────────────

const productChecks = results.checks.filter(c => c.category === 'product');
const conventionChecks = results.checks.filter(c => c.category === 'convention');
const productPassed = productChecks.filter(c => c.passed).length;
const conventionPassed = conventionChecks.filter(c => c.passed).length;

// Must pass all product checks and at least 2/4 convention checks
results.passed = productPassed === productChecks.length && conventionPassed >= 2;
results.summary = `${productPassed}/${productChecks.length} product, ${conventionPassed}/${conventionChecks.length} convention`;

console.log(JSON.stringify(results, null, 2));
