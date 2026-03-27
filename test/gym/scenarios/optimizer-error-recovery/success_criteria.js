/**
 * Success Criteria for "optimizer-error-recovery"
 *
 * Tests both PRODUCT (correct report) and PROCESS (error recovery, path discovery):
 *
 * Product:
 *   1. report.md exists with required sections
 *   2. Report contains accurate statistics (correct agent counts, failure rates)
 *   3. Report mentions corrupted/skipped files
 *
 * Process (Behavioral):
 *   FM-1.4: Agent must recover from corrupted JSON files without crashing
 *   FM-2.1: Agent must discover paths (ls/find) rather than guessing
 *   FM-3.3: Agent must verify report exists before finishing
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'optimizer-error-recovery',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, category, fn) {
  try {
    const result = fn();
    results.checks.push({
      name,
      passed: result.passed,
      detail: result.detail,
      category: category
    });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}`, category });
    return false;
  }
}

// --- PRODUCT CHECKS ---

const reportPath = path.join(envDir, 'report.md');

const reportExists = check('report-exists', 'product', () => {
  const exists = fs.existsSync(reportPath);
  return {
    passed: exists,
    detail: exists ? 'report.md exists' : 'report.md not found'
  };
});

let reportContent = '';
if (reportExists) {
  reportContent = fs.readFileSync(reportPath, 'utf-8');
}

check('report-has-summary-table', 'product', () => {
  // Check for agent names and some tabular structure
  const hasCoder = /coder/i.test(reportContent);
  const hasOptimizer = /optimizer/i.test(reportContent);
  const hasTechLead = /tech.?lead/i.test(reportContent);
  const hasTable = /\|.*\|/.test(reportContent) || (hasCoder && hasOptimizer && hasTechLead);
  return {
    passed: hasCoder && hasOptimizer && hasTechLead,
    detail: `Mentions: coder=${hasCoder}, optimizer=${hasOptimizer}, tech-lead=${hasTechLead}`
  };
});

check('report-has-fm-codes', 'product', () => {
  // Must mention top FM codes: FM-3.3 (3 occurrences), FM-1.4 (2), FM-2.1 (2), FM-2.2 (2)
  const hasFM33 = /FM-3\.3/i.test(reportContent);
  const hasFM14 = /FM-1\.4/i.test(reportContent);
  const anyFMCode = /FM-\d+\.\d+/.test(reportContent);
  return {
    passed: anyFMCode && (hasFM33 || hasFM14),
    detail: `FM codes present: FM-3.3=${hasFM33}, FM-1.4=${hasFM14}, anyFM=${anyFMCode}`
  };
});

check('report-mentions-corrupted-files', 'product', () => {
  const mentionsCorrupt = /corrupt|invalid|skipped|malformed|broken|error/i.test(reportContent);
  const mentionsFiles = /s009|s010|corrupt/i.test(reportContent);
  return {
    passed: mentionsCorrupt && mentionsFiles,
    detail: `Mentions corruption=${mentionsCorrupt}, specific files=${mentionsFiles}`
  };
});

check('report-has-recommendation', 'product', () => {
  const hasRecommend = /recommend|suggest|improve|action|should/i.test(reportContent);
  return {
    passed: hasRecommend,
    detail: `Has recommendation language: ${hasRecommend}`
  };
});

// --- PROCESS CHECKS ---
// These would normally check transcript, but for standalone scoring we verify
// the report quality as evidence of good process

check('handled-both-batches', 'process', () => {
  // If the agent found data from both batch-a and batch-b, they discovered paths properly
  // coder has 4 sessions (s001,s002,s005 in batch-a, s008 in batch-b)
  // Correct total: 4 coder sessions. If agent only found batch-a, they'd report 3.
  const mentionsFourCoder = /4\s*(session|total|count)?/i.test(reportContent) || 
                             /coder.*4|4.*coder/i.test(reportContent);
  // Also accept if they correctly show 8 total valid sessions
  const mentionsEightTotal = /\b8\b/.test(reportContent);
  return {
    passed: mentionsFourCoder || mentionsEightTotal,
    detail: `Evidence of both batches: fourCoder=${mentionsFourCoder}, eightTotal=${mentionsEightTotal}`
  };
});

check('correct-failure-counts', 'process', () => {
  // Correct: coder 2 failures/4 sessions (50%), optimizer 2/2 (100%), tech-lead 1/2 (50%)
  // Check for evidence of accurate counting
  const has50 = /50%|0\.5|2\/4|1\/2/.test(reportContent);
  const has100 = /100%|1\.0|2\/2/.test(reportContent);
  return {
    passed: has50 || has100,
    detail: `Failure rate evidence: 50%=${has50}, 100%=${has100}`
  };
});

// --- SCORING ---
const passed = results.checks.filter(c => c.passed).length;
const total = results.checks.length;
results.passed = passed >= 5; // Need 5/7 to pass
results.summary = `${passed}/${total} checks passed`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
