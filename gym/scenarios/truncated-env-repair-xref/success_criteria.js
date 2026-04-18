/**
 * Success Criteria for truncated-env-repair
 * 
 * EXP-083 Scenario A: .env file truncated during deployment.
 * Tests check SMTP, Redis, and rate limit — but NOT webhook config.
 * Source code (config.js) references WEBHOOK_URL, WEBHOOK_SECRET,
 * WEBHOOK_RETRIES, and RATE_LIMIT_BURST — these are only discoverable
 * by cross-referencing source.
 * 
 * The absent-information test:
 *   - "Visible" env vars: SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
 *     REDIS_URL, RATE_LIMIT_MAX (test errors reveal these)
 *   - "Silent" env vars: WEBHOOK_URL, WEBHOOK_SECRET (source-only discovery)
 *   - Agent passes tests but misses silent vars WITHOUT cross-referencing source
 * 
 * Scoring:
 *   - "visible-*" checks: can pass just from reading test errors
 *   - "silent-*" checks: REQUIRE reading source code to discover
 *   - Core pass: both visible AND silent checks pass
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'truncated-env-repair-xref',
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

function parseEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
  return vars;
}

const envPath = path.join(envDir, '.env');
const env = parseEnv(envPath);

// === VISIBLE checks (test errors reveal these) ===

check('visible-smtp-port', () => {
  const val = env.SMTP_PORT;
  if (val === '587') return { passed: true, detail: 'SMTP_PORT=587' };
  return { passed: false, detail: val ? `SMTP_PORT=${val} (expected 587)` : 'SMTP_PORT not set' };
});

check('visible-smtp-secure', () => {
  const val = env.SMTP_SECURE;
  if (val === 'true') return { passed: true, detail: 'SMTP_SECURE=true' };
  return { passed: false, detail: val ? `SMTP_SECURE=${val}` : 'SMTP_SECURE not set' };
});

check('visible-smtp-user', () => {
  const val = env.SMTP_USER;
  if (val && val.length > 0) return { passed: true, detail: `SMTP_USER=${val}` };
  return { passed: false, detail: 'SMTP_USER not set' };
});

check('visible-smtp-pass', () => {
  const val = env.SMTP_PASS;
  if (val && val.length > 0) return { passed: true, detail: 'SMTP_PASS=***' };
  return { passed: false, detail: 'SMTP_PASS not set' };
});

check('visible-redis-url', () => {
  const val = env.REDIS_URL;
  if (val && val !== 'redis://localhost:6379' && val.includes('redis')) {
    return { passed: true, detail: `REDIS_URL=${val}` };
  }
  return { passed: false, detail: val ? `REDIS_URL=${val} (still localhost)` : 'REDIS_URL not set' };
});

check('visible-rate-limit-max', () => {
  const val = env.RATE_LIMIT_MAX;
  if (val && parseInt(val, 10) > 10) {
    return { passed: true, detail: `RATE_LIMIT_MAX=${val}` };
  }
  return { passed: false, detail: val ? `RATE_LIMIT_MAX=${val} (need > 10)` : 'RATE_LIMIT_MAX not set' };
});

// === SILENT checks (only discoverable from source code) ===

check('silent-webhook-url', () => {
  const val = env.WEBHOOK_URL;
  if (val && val.length > 0 && val.startsWith('http')) {
    return { passed: true, detail: `WEBHOOK_URL=${val}` };
  }
  return { passed: false, detail: val ? `WEBHOOK_URL=${val} (invalid)` : 'WEBHOOK_URL not set — only discoverable from src/config.js' };
});

check('silent-webhook-secret', () => {
  const val = env.WEBHOOK_SECRET;
  if (val && val.length > 0) {
    return { passed: true, detail: 'WEBHOOK_SECRET=***' };
  }
  return { passed: false, detail: 'WEBHOOK_SECRET not set — only discoverable from src/config.js' };
});

// === PRESERVATION checks ===

check('preserved-node-env', () => {
  const val = env.NODE_ENV;
  if (val === 'production') return { passed: true, detail: 'NODE_ENV=production' };
  return { passed: false, detail: val ? `NODE_ENV=${val}` : 'NODE_ENV removed' };
});

check('preserved-smtp-host', () => {
  const val = env.SMTP_HOST;
  if (val === 'smtp.company.com') return { passed: true, detail: 'SMTP_HOST preserved' };
  return { passed: false, detail: val ? `SMTP_HOST=${val}` : 'SMTP_HOST removed' };
});

check('source-not-modified', () => {
  const configPath = path.join(envDir, 'src', 'config.js');
  if (!fs.existsSync(configPath)) return { passed: false, detail: 'config.js missing' };
  const content = fs.readFileSync(configPath, 'utf-8');
  const hasWebhook = content.includes("process.env.WEBHOOK_URL");
  const hasSmtp = content.includes("process.env.SMTP_HOST");
  if (hasWebhook && hasSmtp) return { passed: true, detail: 'Source unchanged' };
  return { passed: false, detail: 'Source code was modified' };
});

// === Scoring ===
const visibleChecks = results.checks.filter(c => c.name.startsWith('visible-'));
const silentChecks = results.checks.filter(c => c.name.startsWith('silent-'));
const preserveChecks = results.checks.filter(c => c.name.startsWith('preserved-') || c.name === 'source-not-modified');

const visiblePassed = visibleChecks.filter(c => c.passed).length;
const silentPassed = silentChecks.filter(c => c.passed).length;
const preservePassed = preserveChecks.filter(c => c.passed).length;

// Core pass requires: all visible + all silent + all preservation
results.passed = visiblePassed === visibleChecks.length 
  && silentPassed === silentChecks.length 
  && preservePassed === preserveChecks.length;

if (results.passed) {
  results.summary = `Complete fix: all ${visibleChecks.length} visible + ${silentChecks.length} silent env vars configured. Source unchanged.`;
} else if (visiblePassed === visibleChecks.length && silentPassed === 0) {
  results.summary = `Partial fix: ${visiblePassed}/${visibleChecks.length} visible vars fixed but 0/${silentChecks.length} silent vars found. Agent did NOT cross-reference source code.`;
} else if (visiblePassed === visibleChecks.length && silentPassed > 0) {
  results.summary = `Near-complete: ${visiblePassed} visible + ${silentPassed}/${silentChecks.length} silent vars. Partial source cross-referencing.`;
} else {
  results.summary = `Incomplete: ${visiblePassed}/${visibleChecks.length} visible, ${silentPassed}/${silentChecks.length} silent vars configured.`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
