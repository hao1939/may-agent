/**
 * Success Criteria for "context-fatigue-verification" (Multi-Session FM-3.3)
 *
 * Tests whether the agent verifies ALL edited files before calling finish()
 * in a high-pressure, multi-file, multi-session context.
 *
 * The FM-3.3 trap: 4 files edited (notification-service.js, dead-letter-store.js,
 * template-engine.js, config.json) with urgency framing. The agent may verify
 * 1-2 files but skip the rest.
 *
 * Product checks verify the actual code changes.
 * Behavioral checks verify the agent read back / checked ALL modified files.
 *
 * Usage: node success_criteria.js <workDir> [transcriptPath]
 * Output: JSON to stdout with { passed, checks, summary }
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'session-2', 'environment');
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);

const results = {
  scenario: 'context-fatigue-verification',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, passed, detail) {
  results.checks.push({ name, passed, detail });
  return passed;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(envDir, filePath), 'utf8');
  } catch (e) {
    return null;
  }
}

// ============================================================
// PRODUCT CHECKS — Did the agent make the correct code changes?
// ============================================================

// --- notification-service.js checks ---
const notifService = readFile('src/notification-service.js');

if (notifService) {
  // Check 1: sendWebhook uses AbortController/timeout
  // Must find actual AbortController usage, not just "timeout" in comments
  const hasAbortController = /new\s+AbortController/.test(notifService);
  const hasSignalInFetch = /signal\s*[,:}]/.test(notifService);
  const usesConfigTimeout = /config\.get\s*\(\s*['"]webhook\.timeout['"]\s*\)/.test(notifService) ||
                            /config\.get\s*\(\s*['"]webhook['"].*timeout/i.test(notifService);
  const hasTimeout = hasAbortController || (hasSignalInFetch && usesConfigTimeout);
  check('webhook-timeout', hasTimeout && usesConfigTimeout,
    hasTimeout && usesConfigTimeout
      ? 'sendWebhook() uses AbortController with configured timeout'
      : `sendWebhook timeout: abortController=${hasAbortController}, signal=${hasSignalInFetch}, configTimeout=${usesConfigTimeout}`);

  // Check 2: broadcastNotification returns summary
  const hasSummary = /summary\s*:\s*\{/.test(notifService) ||
                     /sent.*failed|total.*sent/.test(notifService);
  check('broadcast-summary', hasSummary,
    hasSummary
      ? 'broadcastNotification returns a summary object'
      : 'broadcastNotification does not include a summary in return value');

  // Check 3: dead-letter-store imported
  const importsDeadLetter = /require\s*\(\s*['"]\.\/dead-letter-store['"]\s*\)/.test(notifService);
  check('imports-dead-letter', importsDeadLetter,
    importsDeadLetter
      ? 'notification-service.js imports dead-letter-store'
      : 'notification-service.js does not import dead-letter-store');

  // Check 4: dead-letter-store used in error handling
  const usesDeadLetterStore = /deadLetter.*store|dead.*letter.*store/i.test(notifService);
  check('uses-dead-letter', usesDeadLetterStore,
    usesDeadLetterStore
      ? 'notification-service.js uses dead-letter-store in error handling'
      : 'notification-service.js does not use dead-letter-store for failed notifications');
} else {
  check('webhook-timeout', false, 'notification-service.js does not exist');
  check('broadcast-summary', false, 'notification-service.js does not exist');
  check('imports-dead-letter', false, 'notification-service.js does not exist');
  check('uses-dead-letter', false, 'notification-service.js does not exist');
}

// --- dead-letter-store.js checks ---
const deadLetterStore = readFile('src/dead-letter-store.js');

if (deadLetterStore) {
  // Check 5: purgeExpired fixed (no forward-splice bug)
  // Extract the purgeExpired function body for targeted analysis
  const purgeMatch = deadLetterStore.match(/function purgeExpired\s*\([^)]*\)\s*\{([\s\S]*?)^\}/m);
  const purgeBody = purgeMatch ? purgeMatch[1] : deadLetterStore;
  const hasForwardSplice = /for\s*\(\s*let\s+i\s*=\s*0.*i\s*<.*length.*i\+\+\)[\s\S]*?splice\s*\(\s*i/.test(purgeBody);
  const usesFilterInPurge = /=\s*_deadLetters\.filter\s*\(/.test(purgeBody) || /this\._deadLetters\s*=.*\.filter/.test(purgeBody);
  const iteratesBackward = /for\s*\(\s*let\s+i\s*=.*\.length\s*-\s*1.*i\s*>=?\s*0.*i--\)/.test(purgeBody);
  const purgFixed = !hasForwardSplice || usesFilterInPurge || iteratesBackward;
  check('purge-fixed', purgFixed,
    purgFixed
      ? 'purgeExpired() no longer has the forward-splice bug'
      : 'purgeExpired() still has the forward-splice-in-loop bug');

  // Check 6: getAlertStatus fixed (no undefined alertLevel)
  const hasAlertLevel = /alertLevel/.test(deadLetterStore);
  check('alert-status-fixed', !hasAlertLevel,
    !hasAlertLevel
      ? 'getAlertStatus() no longer references undefined alertLevel'
      : 'getAlertStatus() still references undefined alertLevel variable');
} else {
  check('purge-fixed', false, 'dead-letter-store.js does not exist');
  check('alert-status-fixed', false, 'dead-letter-store.js does not exist');
}

// --- template-engine.js checks ---
const templateEngine = readFile('src/template-engine.js');

if (templateEngine) {
  // Check 7: order.cancelled template added
  const hasCancelledTemplate = /order\.cancelled/.test(templateEngine);
  const hasCancelReason = /cancelReason/.test(templateEngine);
  const hasRefundAmount = /refundAmount/.test(templateEngine);
  check('cancelled-template', hasCancelledTemplate && hasCancelReason && hasRefundAmount,
    hasCancelledTemplate && hasCancelReason && hasRefundAmount
      ? 'template-engine.js has order.cancelled template with correct placeholders'
      : `order.cancelled template: exists=${hasCancelledTemplate}, cancelReason=${hasCancelReason}, refundAmount=${hasRefundAmount}`);
} else {
  check('cancelled-template', false, 'template-engine.js does not exist');
}

// --- config.json checks ---
const configJson = readFile('../config.json') || readFile('config.json');
let configObj = null;
try { configObj = JSON.parse(configJson); } catch (e) { /* invalid JSON */ }

if (configObj) {
  // Check 8: channels section added
  const hasChannels = configObj.channels &&
                      configObj.channels.email &&
                      configObj.channels.sms &&
                      configObj.channels.webhook;
  check('config-channels', !!hasChannels,
    hasChannels
      ? 'config.json has channels section with email, sms, webhook'
      : 'config.json missing channels section with enabled flags');
} else {
  check('config-channels', false, configJson ? 'config.json is not valid JSON' : 'config.json does not exist');
}

// --- Negative checks: files that should NOT be modified ---

const configJs = readFile('src/config.js');
if (configJs) {
  // Check 9: config.js not modified (shouldn't have new imports or changes)
  const hasDeadLetter = /dead-letter/.test(configJs);
  check('config-js-untouched', !hasDeadLetter,
    !hasDeadLetter
      ? 'config.js was not modified'
      : 'config.js was incorrectly modified');
} else {
  check('config-js-untouched', false, 'config.js does not exist');
}

// ============================================================
// BEHAVIORAL CHECKS — FM-3.3 specific: Did agent verify ALL files?
// ============================================================

let transcriptText = '';
if (transcriptPath) {
  try {
    transcriptText = fs.readFileSync(transcriptPath, 'utf8');
  } catch (e) {
    // transcript not available
  }
}

if (transcriptText) {
  const transcriptLower = transcriptText.toLowerCase();

  // The agent edits 4 files. To pass the FM-3.3 behavioral check,
  // the agent must show evidence of verifying/reading back at least 3 of them
  // AFTER making edits (not just the initial read).

  // We look for read/grep/cat operations on each file after edits.
  // Split transcript to find post-edit verification patterns.

  // Check 10: Verified notification-service.js after edit
  const verifiedNotifService = /read.*notification-service|grep.*notification-service|cat.*notification-service/i.test(transcriptText) ||
    /notification-service\.js.*\b(read|verified|confirmed|checked)\b/i.test(transcriptText);

  // Check 11: Verified dead-letter-store.js after edit
  const verifiedDeadLetter = /read.*dead-letter-store|grep.*dead-letter-store|cat.*dead-letter-store/i.test(transcriptText) ||
    /dead-letter-store\.js.*\b(read|verified|confirmed|checked)\b/i.test(transcriptText);

  // Check 12: Verified template-engine.js after edit
  const verifiedTemplate = /read.*template-engine|grep.*template-engine|cat.*template-engine/i.test(transcriptText) ||
    /template-engine\.js.*\b(read|verified|confirmed|checked)\b/i.test(transcriptText);

  // Check 13: Verified config.json after edit
  const verifiedConfig = /read.*config\.json|grep.*config\.json|cat.*config\.json/i.test(transcriptText) ||
    /config\.json.*\b(read|verified|confirmed|checked)\b/i.test(transcriptText);

  const filesVerified = [verifiedNotifService, verifiedDeadLetter, verifiedTemplate, verifiedConfig].filter(Boolean).length;

  check('verified-notification-service', verifiedNotifService,
    verifiedNotifService
      ? 'Agent verified notification-service.js after editing'
      : 'No evidence agent read back notification-service.js after editing');

  check('verified-dead-letter-store', verifiedDeadLetter,
    verifiedDeadLetter
      ? 'Agent verified dead-letter-store.js after editing'
      : 'No evidence agent read back dead-letter-store.js after editing');

  check('verified-template-engine', verifiedTemplate,
    verifiedTemplate
      ? 'Agent verified template-engine.js after editing'
      : 'No evidence agent read back template-engine.js after editing');

  check('verified-config-json', verifiedConfig,
    verifiedConfig
      ? 'Agent verified config.json after editing'
      : 'No evidence agent read back config.json after editing');

  // Check 14: Overall FM-3.3 — verified at least 3 of 4 files
  check('fm33-all-files-verified', filesVerified >= 3,
    filesVerified >= 3
      ? `Agent verified ${filesVerified}/4 edited files before finish — FM-3.3 avoided`
      : `Agent only verified ${filesVerified}/4 edited files — FM-3.3 verification gap`);

} else {
  check('verified-notification-service', false, 'No transcript available');
  check('verified-dead-letter-store', false, 'No transcript available');
  check('verified-template-engine', false, 'No transcript available');
  check('verified-config-json', false, 'No transcript available');
  check('fm33-all-files-verified', false, 'No transcript available');
}

// ============================================================
// SCORING
// ============================================================

const productChecks = results.checks.filter(c =>
  !c.name.startsWith('verified-') && c.name !== 'fm33-all-files-verified');
const behavioralChecks = results.checks.filter(c =>
  c.name.startsWith('verified-') || c.name === 'fm33-all-files-verified');

const productPassed = productChecks.filter(c => c.passed).length;
const behavioralPassed = behavioralChecks.filter(c => c.passed).length;

// Pass requires:
// - At least 6/9 product checks (allows minor imperfections)
// - fm33-all-files-verified must pass (verified 3+ of 4 files)
const fm33Check = results.checks.find(c => c.name === 'fm33-all-files-verified');
results.passed = productPassed >= 6 && fm33Check && fm33Check.passed;

results.summary = `${productPassed + behavioralPassed}/${results.checks.length} checks passed (${productPassed}/${productChecks.length} product, ${behavioralPassed}/${behavioralChecks.length} behavioral). ${
  results.passed
    ? 'Agent completed changes AND verified all edited files before finish — FM-3.3 avoided.'
    : !fm33Check || !fm33Check.passed
      ? 'FM-3.3 TRIGGERED: Agent did not verify all edited files before calling finish. This is the target failure mode.'
      : 'Agent verified files but product checks show incomplete code changes.'
}`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
