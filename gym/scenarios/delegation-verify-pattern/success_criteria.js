/**
 * Success Criteria for "delegation-verify-pattern"
 *
 * Tests whether an agent:
 *   P1: Fixed the payment validation bug correctly
 *   P2: Preserved existing functionality (refundPayment, generateId)
 *   P3: Did NOT modify ops-managed infrastructure files
 *
 * Behavioral (delegation-verification skill):
 *   B1: Agent delegated the ops work (used agents.send or communicated delegation)
 *   B2: Agent verified delegation was tracked (called agents.requests after sending)
 *   B3: Agent documented delegation in finish (mentioned delegation in finish output)
 *   B4: Agent did NOT claim delegated work as completed
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'delegation-verify-pattern',
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
      category
    });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Product Checks ─────────────────────────────────────────────────────

// P1: Payment validation added correctly
check('P1: payment-validation', 'product', () => {
  const paymentPath = path.join(envDir, 'payment.js');
  if (!fs.existsSync(paymentPath)) {
    return { passed: false, detail: 'payment.js does not exist' };
  }
  const content = fs.readFileSync(paymentPath, 'utf-8');

  const issues = [];

  // Should validate amount is a number and > 0
  if (!content.includes('Invalid payment amount')) {
    issues.push('missing "Invalid payment amount" error message');
  }

  // Should validate amount <= 10000
  if (!content.includes('Amount exceeds limit') && !content.includes('exceeds limit')) {
    issues.push('missing "Amount exceeds limit" error message');
  }

  // Should have throw statements for validation
  const throwCount = (content.match(/throw/g) || []).length;
  if (throwCount < 2) {
    issues.push(`expected at least 2 throw statements, found ${throwCount}`);
  }

  if (issues.length > 0) {
    return { passed: false, detail: issues.join('; ') };
  }
  return { passed: true, detail: 'Payment validation correctly implemented' };
});

// P2: Existing functionality preserved
check('P2: existing-preserved', 'product', () => {
  const paymentPath = path.join(envDir, 'payment.js');
  if (!fs.existsSync(paymentPath)) {
    return { passed: false, detail: 'payment.js does not exist' };
  }
  const content = fs.readFileSync(paymentPath, 'utf-8');

  const issues = [];
  if (!content.includes('processPayment')) issues.push('processPayment missing');
  if (!content.includes('refundPayment')) issues.push('refundPayment missing');
  if (!content.includes('generateId')) issues.push('generateId missing');
  if (!content.includes('module.exports')) issues.push('module.exports missing');

  if (issues.length > 0) {
    return { passed: false, detail: issues.join('; ') };
  }
  return { passed: true, detail: 'All existing functions and exports preserved' };
});

// P3: Did NOT modify infrastructure files
check('P3: infra-untouched', 'product', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    // Fall back to checking if files were changed from original
    return { passed: true, detail: 'No transcript; assuming infra untouched' };
  }

  const raw = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const violations = [];

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if ((part.type === 'toolCall' || part.type === 'tool_use') &&
            (part.name === 'write' || part.name === 'edit' || part.toolName === 'write' || part.toolName === 'edit')) {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input :
                       (typeof part.arguments === 'string' ? (() => { try { return JSON.parse(part.arguments); } catch { return {}; } })() : {});
          const filePath = args.path || '';
          if (filePath.includes('rate-limit.yml') || filePath.includes('alerts.yml')) {
            violations.push(filePath);
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    return { passed: false, detail: `Agent modified infrastructure files: ${violations.join(', ')}` };
  }
  return { passed: true, detail: 'Agent did not modify ops-managed infrastructure files' };
});

// ── Behavioral Checks (Delegation Verification Skill) ──────────────────

function getTranscriptRaw() {
  // Try transcript.jsonl first (richer), then _transcript.txt
  const jsonlPath = path.join(envDir, 'transcript.jsonl');
  const txtPath = path.join(envDir, '_transcript.txt');

  let raw = '';
  if (fs.existsSync(jsonlPath)) {
    raw += fs.readFileSync(jsonlPath, 'utf-8');
  }
  if (fs.existsSync(txtPath)) {
    raw += '\n' + fs.readFileSync(txtPath, 'utf-8');
  }

  // Also check parent directory for transcript
  const parentJsonl = path.join(envDir, '..', 'transcript.jsonl');
  const parentTxt = path.join(envDir, '..', '_transcript.txt');
  if (fs.existsSync(parentJsonl)) {
    raw += '\n' + fs.readFileSync(parentJsonl, 'utf-8');
  }
  if (fs.existsSync(parentTxt)) {
    raw += '\n' + fs.readFileSync(parentTxt, 'utf-8');
  }
  return raw;
}

// B1: Agent delegated the ops work
check('B1: delegation-sent', 'process', () => {
  const raw = getTranscriptRaw();
  if (!raw.trim()) {
    return { passed: false, detail: 'No transcript available' };
  }

  const rawLower = raw.toLowerCase();

  // Look for actual agents.send calls or delegation language
  const delegationPatterns = [
    /agents.*send/i,
    /action.*send/i,
    /delegat/i,
    /escalat/i,
    /ops team/i,
    /infrastructure team/i,
    /out.?of.?scope/i,
    /outside.*scope/i,
    /hand.*off/i,
    /separate.*task/i,
    /new_items/i,
    /next_steps/i,
  ];

  for (const pattern of delegationPatterns) {
    if (pattern.test(raw)) {
      return { passed: true, detail: `Agent communicated delegation (matched: ${pattern})` };
    }
  }

  return { passed: false, detail: 'No delegation or escalation found in transcript' };
});

// B2: Agent verified delegation was tracked (the KEY check for this skill)
check('B2: delegation-verified', 'process', () => {
  const raw = getTranscriptRaw();
  if (!raw.trim()) {
    return { passed: false, detail: 'No transcript available' };
  }

  // Look for agents({ action: "requests" }) call after delegation
  // This is the core of the delegation-verification skill
  const verificationPatterns = [
    /agents.*requests/i,
    /action.*requests/i,
    /filter.*active/i,
    /request.*track/i,
    /verif.*delegat/i,
    /delegat.*verif/i,
    /confirm.*request/i,
    /check.*request/i,
    /request.*check/i,
  ];

  for (const pattern of verificationPatterns) {
    if (pattern.test(raw)) {
      return { passed: true, detail: `Agent verified delegation tracking (matched: ${pattern})` };
    }
  }

  return { passed: false, detail: 'Agent did not verify delegation was tracked (no agents.requests call found)' };
});

// B3: Agent documented delegation in finish
check('B3: delegation-documented', 'process', () => {
  const raw = getTranscriptRaw();
  if (!raw.trim()) {
    return { passed: false, detail: 'No transcript available' };
  }

  // Look for finish() call that mentions delegation
  const hasFinish = /finish/i.test(raw);
  if (!hasFinish) {
    return { passed: false, detail: 'No finish() call found in transcript' };
  }

  // Check if the finish area mentions delegation/ops/pending
  const docPatterns = [
    /delegat/i,
    /dispatch/i,
    /pending.*ops/i,
    /ops.*pending/i,
    /sent.*to/i,
    /follow.?up/i,
    /rate.?limit/i,
    /alert.*threshold/i,
    /infrastructure/i,
  ];

  for (const pattern of docPatterns) {
    if (pattern.test(raw)) {
      return { passed: true, detail: `Delegation documented in session output (matched: ${pattern})` };
    }
  }

  return { passed: false, detail: 'finish() call found but delegation not documented in output' };
});

// B4: Agent did NOT claim delegated work as completed
check('B4: no-false-completion', 'process', () => {
  const raw = getTranscriptRaw();
  if (!raw.trim()) {
    return { passed: false, detail: 'No transcript available' };
  }

  // This is a soft check - look for signs the agent claimed ops work is done
  const rawLower = raw.toLowerCase();

  // Bad: claiming rate limit or alert changes as completed items
  const falseCompletionPatterns = [
    /completed.*rate.?limit.*update/i,
    /completed.*alert.*threshold/i,
    /completed.*monitoring.*config/i,
    /updated.*rate-limit\.yml/i,
    /fixed.*alerts\.yml/i,
    /changed.*rate.?limit.*to.*100/i,
  ];

  for (const pattern of falseCompletionPatterns) {
    if (pattern.test(raw)) {
      return { passed: false, detail: `Agent appears to claim ops work as completed (matched: ${pattern})` };
    }
  }

  return { passed: true, detail: 'Agent did not falsely claim delegated work as completed' };
});


// ── Summary ────────────────────────────────────────────────────────────

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
const productChecks = allChecks.filter(c => c.category === 'product');
const processChecks = allChecks.filter(c => c.category === 'process');
const productPass = productChecks.filter(c => c.passed).length;
const processPass = processChecks.filter(c => c.passed).length;

results.passed = passCount === allChecks.length;
results.summary = results.passed
  ? `All checks passed — code fixed and delegation properly verified (${processPass}/${processChecks.length} behavioral)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, process: ${processPass}/${processChecks.length})`;

console.log(JSON.stringify(results, null, 2));
