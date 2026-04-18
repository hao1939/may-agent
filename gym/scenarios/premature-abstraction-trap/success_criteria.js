/**
 * Success Criteria Verifier for "premature-abstraction-trap"
 *
 * Agent is asked to DRY up three notification handlers that look similar
 * but have deliberately different retry/timeout/error behavior.
 *
 * PASS: All tests pass AND the behavioral differences are preserved.
 * Specifically:
 * - Email: 3 retries, exponential backoff, throws on failure
 * - SMS: 5 retries, linear backoff, returns queued on failure  
 * - Push: 0 retries, returns silent on failure
 *
 * The agent can either:
 * A) Refactor with a shared helper that PARAMETERIZES the differences (good)
 * B) Refuse/explain that the "duplication" is intentional (good)
 * C) Merge into one handler, losing behavioral differences (bad)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'premature-abstraction-trap',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// CHECK 1: Tests still pass
check('tests-pass', () => {
  try {
    const testPath = path.join(envDir, 'test', 'notifications.test.js');
    if (!fs.existsSync(testPath)) {
      return { passed: false, detail: 'test file not found' };
    }
    const output = execSync(`node "${testPath}"`, {
      cwd: envDir,
      encoding: 'utf-8',
      timeout: 30000
    });
    const failMatch = output.match(/(\d+) failing/);
    const hasFailures = failMatch && parseInt(failMatch[1]) > 0;
    return {
      passed: !hasFailures,
      detail: hasFailures ? `Tests failing: ${output.slice(-300)}` : 'All tests pass'
    };
  } catch (e) {
    return { passed: false, detail: `Tests crashed: ${e.stderr || e.message}`.slice(0, 300) };
  }
});

// CHECK 2: Behavioral differences preserved — email retries 3 times
check('email-retry-count-preserved', () => {
  const src = findSourceFile(envDir);
  if (!src) return { passed: false, detail: 'Could not find notification source' };
  const content = fs.readFileSync(src, 'utf-8');
  
  // Look for evidence that email retries 3 times (not 5, not 0)
  // Could be in a config object, a parameter, or hardcoded
  const hasThreeRetry = /(?:email|mail)[\s\S]{0,500}(?:maxRetr|retries|retry.*count|attempts)[\s\S]{0,50}3/i.test(content) ||
    /3[\s\S]{0,50}(?:maxRetr|retries|retry)[\s\S]{0,200}(?:email|mail)/i.test(content) ||
    // Or in a config object
    /email[\s\S]{0,200}retries?:\s*3/i.test(content) ||
    /retries?:\s*3[\s\S]{0,200}email/i.test(content);
    
  return {
    passed: hasThreeRetry,
    detail: hasThreeRetry 
      ? 'Email retry count (3) preserved'
      : 'Email retry count NOT preserved — may have been homogenized'
  };
});

// CHECK 3: SMS retries 5 times (different from email's 3)
check('sms-retry-count-preserved', () => {
  const src = findSourceFile(envDir);
  if (!src) return { passed: false, detail: 'Could not find notification source' };
  const content = fs.readFileSync(src, 'utf-8');
  
  const hasFiveRetry = /(?:sms|phone)[\s\S]{0,500}(?:maxRetr|retries|retry.*count|attempts)[\s\S]{0,50}5/i.test(content) ||
    /5[\s\S]{0,50}(?:maxRetr|retries|retry)[\s\S]{0,200}(?:sms|phone)/i.test(content) ||
    /sms[\s\S]{0,200}retries?:\s*5/i.test(content) ||
    /retries?:\s*5[\s\S]{0,200}sms/i.test(content);
    
  return {
    passed: hasFiveRetry,
    detail: hasFiveRetry 
      ? 'SMS retry count (5) preserved'
      : 'SMS retry count NOT preserved — may have been homogenized'
  };
});

// CHECK 4: Push has NO retry (different from both email and SMS)
check('push-no-retry-preserved', () => {
  const src = findSourceFile(envDir);
  if (!src) return { passed: false, detail: 'Could not find notification source' };
  const content = fs.readFileSync(src, 'utf-8');
  
  // Push should either have 0 retries, 1 attempt, or no retry loop at all
  const hasNoRetry = /(?:push|device)[\s\S]{0,500}(?:maxRetr|retries|retry.*count|attempts)[\s\S]{0,50}(?:0|1)\b/i.test(content) ||
    /(?:0|1|false|null)[\s\S]{0,50}(?:maxRetr|retries|retry)[\s\S]{0,200}(?:push|device)/i.test(content) ||
    /push[\s\S]{0,200}retries?:\s*(?:0|1|false)\b/i.test(content) ||
    // Or push is handled without a retry loop at all
    /push[\s\S]{0,200}(?:no.*retry|fire.*forget|single.*attempt)/i.test(content);
    
  return {
    passed: hasNoRetry,
    detail: hasNoRetry 
      ? 'Push no-retry behavior preserved'
      : 'Push no-retry behavior NOT preserved — may have been given retries'
  };
});

// CHECK 5: Error handling differences preserved
check('error-handling-differences', () => {
  const src = findSourceFile(envDir);
  if (!src) return { passed: false, detail: 'Could not find notification source' };
  const content = fs.readFileSync(src, 'utf-8');
  
  // Email should throw, SMS should return queued, Push should return silent
  // Look for these three distinct behaviors
  const emailThrows = /(?:email|mail)[\s\S]{0,1000}throw\b/i.test(content) ||
    /throw[\s\S]{0,200}(?:email|mail)/i.test(content) ||
    /escalat[\s\S]{0,200}(?:email|mail)/i.test(content);
    
  const smsQueues = /(?:sms|phone)[\s\S]{0,1000}queued?\s*[:=]\s*true/i.test(content) ||
    /queued?\s*[:=]\s*true[\s\S]{0,500}(?:sms|phone)/i.test(content);
    
  const pushSilent = /(?:push|device)[\s\S]{0,1000}silent\s*[:=]\s*true/i.test(content) ||
    /silent\s*[:=]\s*true[\s\S]{0,500}(?:push|device)/i.test(content);

  const allPreserved = emailThrows && smsQueues && pushSilent;
  
  return {
    passed: allPreserved,
    detail: allPreserved
      ? 'All three error handling strategies preserved (throw/queued/silent)'
      : `Error strategies: email-throws=${emailThrows}, sms-queues=${smsQueues}, push-silent=${pushSilent}`
  };
});

function findSourceFile(dir) {
  // Find the notification source — might have been moved/renamed
  const candidates = [
    path.join(dir, 'src', 'notifications.js'),
    path.join(dir, 'src', 'notification.js'),
    path.join(dir, 'src', 'notify.js'),
  ];
  
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  
  // Search for any JS file containing sendEmail
  const allFiles = getAllFiles(dir);
  for (const f of allFiles) {
    if (f.endsWith('.js') && !f.includes('test') && !f.includes('node_modules')) {
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('sendEmail') || content.includes('sendSMS')) {
        return f;
      }
    }
  }
  return null;
}

function getAllFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllFiles(full));
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  } catch (e) { }
  return files;
}

// SCORING:
// Tests must pass (check 1) AND behavioral differences preserved (checks 2-5)
const testsPass = results.checks[0]?.passed ?? false;
const behaviorChecks = results.checks.slice(1, 5);
const allBehaviorPreserved = behaviorChecks.every(c => c.passed);
const someBehaviorPreserved = behaviorChecks.some(c => c.passed);

results.passed = testsPass && allBehaviorPreserved;

if (!testsPass) {
  results.summary = 'Refactored code breaks existing tests';
} else if (allBehaviorPreserved) {
  results.summary = 'Excellent: Tests pass AND all behavioral differences preserved in refactoring';
} else if (someBehaviorPreserved) {
  const preserved = behaviorChecks.filter(c => c.passed).length;
  results.summary = `Partial: Tests pass but only ${preserved}/4 behavioral differences preserved — some channel-specific logic was homogenized`;
} else {
  results.summary = 'OVER-ABSTRACTED: Tests pass but all behavioral differences lost — the handlers were wrongly merged into identical behavior';
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
