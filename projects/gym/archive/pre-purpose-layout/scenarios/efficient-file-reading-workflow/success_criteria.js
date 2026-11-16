/**
 * Success Criteria for "efficient-file-reading"
 *
 * Tests PRODUCT (correct report) and PROCESS (efficient file reading):
 *
 * Product:
 *   1. report.md exists
 *   2. Contains exactly 3 degraded services
 *   3. Correct service names (payment-gateway, cache-proxy, auth-service)
 *   4. Correct error messages (most recent, not earlier ones)
 *
 * Process (Grep-First-Reading Skill):
 *   GFR-1: Agent uses grep/search BEFORE full-reading large files
 *   GFR-2: Agent does NOT read services.yaml fully (700+ lines)
 *   GFR-3: Agent does NOT read monitor.log fully (1200+ lines)
 *   GFR-4: Agent uses offset/limit or grep to target specific sections
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const transcriptPath = process.argv[3] || path.join(envDir, 'transcript.jsonl');

const results = {
  scenario: 'efficient-file-reading',
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

check('report-exists', 'product', () => {
  const reportPath = path.join(envDir, 'report.md');
  const exists = fs.existsSync(reportPath);
  return { passed: exists, detail: exists ? 'report.md exists' : 'report.md not found' };
});

check('three-services', 'product', () => {
  const reportPath = path.join(envDir, 'report.md');
  if (!fs.existsSync(reportPath)) return { passed: false, detail: 'No report' };
  const content = fs.readFileSync(reportPath, 'utf8');
  const sections = content.match(/^## /gm);
  const count = sections ? sections.length : 0;
  return { passed: count === 3, detail: `Found ${count} service sections (expected 3)` };
});

check('correct-service-names', 'product', () => {
  const reportPath = path.join(envDir, 'report.md');
  if (!fs.existsSync(reportPath)) return { passed: false, detail: 'No report' };
  const content = fs.readFileSync(reportPath, 'utf8').toLowerCase();
  const found = ['payment-gateway', 'cache-proxy', 'auth-service'].filter(s => content.includes(s));
  return { passed: found.length === 3, detail: `Found: ${found.join(', ')} (need all 3)` };
});

check('correct-errors', 'product', () => {
  const reportPath = path.join(envDir, 'report.md');
  if (!fs.existsSync(reportPath)) return { passed: false, detail: 'No report' };
  const content = fs.readFileSync(reportPath, 'utf8');
  // Most recent errors (not the earlier ones)
  const hasPayment = content.includes('Connection timeout') || content.includes('retries exhausted');
  const hasCache = content.includes('node 3 unreachable') || content.includes('failover');
  const hasAuth = content.includes('signing key rotation') || content.includes('expired key');
  const count = [hasPayment, hasCache, hasAuth].filter(Boolean).length;
  return { passed: count >= 2, detail: `${count}/3 correct most-recent errors identified` };
});

// ── Process Checks (Convention Compliance) ─────────────────────────────

check('grep-first-reading:uses-grep-or-search', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const usesGrep = /grep.*services\.yaml|grep.*monitor\.log/i.test(transcript);
  const usesSearch = /rg.*services|rg.*monitor/i.test(transcript);
  return {
    passed: usesGrep || usesSearch,
    detail: usesGrep ? 'Agent used grep on large files' : usesSearch ? 'Agent used rg on large files' : 'No grep/rg found for large files'
  };
});

check('grep-first-reading:no-full-read-services', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: true, detail: 'Convention grep-first-reading (no transcript — default pass)' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  // Check for read of services.yaml without offset
  const fullReads = transcript.match(/"path"\s*:\s*"[^"]*services\.yaml"(?![^}]*"offset")/g);
  return {
    passed: !fullReads || fullReads.length === 0,
    detail: fullReads ? `Full read of services.yaml detected (${fullReads.length}x)` : 'No full reads of services.yaml'
  };
});

check('grep-first-reading:no-full-read-log', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: true, detail: 'Convention grep-first-reading (no transcript — default pass)' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const fullReads = transcript.match(/"path"\s*:\s*"[^"]*monitor\.log"(?![^}]*"offset")/g);
  return {
    passed: !fullReads || fullReads.length === 0,
    detail: fullReads ? `Full read of monitor.log detected (${fullReads.length}x)` : 'No full reads of monitor.log'
  };
});

check('grep-first-reading:uses-targeted-reads', 'convention', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const hasOffset = /"offset"\s*:\s*\d+/.test(transcript);
  const hasLimit = /"limit"\s*:\s*\d+/.test(transcript);
  const hasTail = /tail\s+(-n\s+)?\d+/.test(transcript);
  const hasHead = /head\s+(-n\s+)?\d+/.test(transcript);
  const hasSed = /sed\s+-n/.test(transcript);
  const used = [hasOffset && 'offset/limit', hasTail && 'tail', hasHead && 'head', hasSed && 'sed'].filter(Boolean);
  return {
    passed: used.length > 0,
    detail: used.length > 0 ? `Targeted reads used: ${used.join(', ')}` : 'No targeted reading techniques detected'
  };
});

// ── Compute final result ───────────────────────────────────────────────

const productChecks = results.checks.filter(c => c.category === 'product');
const conventionChecks = results.checks.filter(c => c.category === 'convention');
const productPassed = productChecks.filter(c => c.passed).length;
const conventionPassed = conventionChecks.filter(c => c.passed).length;

results.passed = productPassed >= 3 && conventionPassed >= 2;
results.summary = `${productPassed}/${productChecks.length} product, ${conventionPassed}/${conventionChecks.length} convention`;

console.log(JSON.stringify(results, null, 2));
