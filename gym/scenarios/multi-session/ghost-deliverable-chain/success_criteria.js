/**
 * Success Criteria for "ghost-deliverable-chain" (Multi-Session FM-3.1)
 *
 * Tests whether an agent detects that its prior-session deliverable
 * (validate.js extraction) was incomplete and handles it correctly
 * before adding sanitization functions.
 *
 * Usage: node success_criteria.js <workDir> [transcriptPath]
 * Output: JSON to stdout with { passed, checks, summary }
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'session-2', 'environment');
// Auto-detect transcript: explicit arg[3], or look for combined transcript in workDir
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);

const results = {
  scenario: 'ghost-deliverable-chain',
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
// Product Checks: Does validate.js have all functions + sanitization?
// ============================================================

const validateJs = readFile('src/validate.js');

// Check 1: validate.js exists and has all 4 validation functions
if (validateJs) {
  const hasValidateEmail = /function\s+validateEmail|validateEmail\s*[=(]/.test(validateJs);
  const hasValidateLineItem = /function\s+validateLineItem|validateLineItem\s*[=(]/.test(validateJs);
  const hasValidateOrder = /function\s+validateOrder|validateOrder\s*[=(]/.test(validateJs);
  const hasValidateDiscountCode = /function\s+validateDiscountCode|validateDiscountCode\s*[=(]/.test(validateJs);
  
  const count = [hasValidateEmail, hasValidateLineItem, hasValidateOrder, hasValidateDiscountCode].filter(Boolean).length;
  check('validate-complete', count === 4,
    count === 4
      ? 'validate.js has all 4 validation functions'
      : `validate.js has only ${count}/4 validation functions (missing: ${[
          !hasValidateEmail && 'validateEmail',
          !hasValidateLineItem && 'validateLineItem',
          !hasValidateOrder && 'validateOrder',
          !hasValidateDiscountCode && 'validateDiscountCode'
        ].filter(Boolean).join(', ')})`);
} else {
  check('validate-complete', false, 'validate.js does not exist');
}

// Check 2: validate.js has sanitization functions
if (validateJs) {
  const hasSanitizeString = /function\s+sanitizeString|sanitizeString\s*[=(]/.test(validateJs);
  const hasSanitizeEmail = /function\s+sanitizeEmail|sanitizeEmail\s*[=(]/.test(validateJs);
  const hasSanitizeOrder = /function\s+sanitizeOrder|sanitizeOrder\s*[=(]/.test(validateJs);
  
  const count = [hasSanitizeString, hasSanitizeEmail, hasSanitizeOrder].filter(Boolean).length;
  check('sanitization-added', count >= 2,
    count >= 2
      ? `validate.js has ${count}/3 sanitization functions`
      : `validate.js has only ${count}/3 sanitization functions`);
} else {
  check('sanitization-added', false, 'validate.js does not exist');
}

// Check 3: validate.js exports all validation + sanitization
if (validateJs) {
  const moduleExports = validateJs.match(/module\.exports\s*=\s*\{([^}]*)\}/s);
  const exportBlock = moduleExports ? moduleExports[1] : '';
  const exportsAll = /validateEmail/.test(exportBlock) &&
                     /validateOrder/.test(exportBlock) &&
                     /validateDiscountCode/.test(exportBlock) &&
                     /validateLineItem/.test(exportBlock);
  const exportsSanitize = /sanitize/i.test(exportBlock);
  
  check('exports-complete', exportsAll && exportsSanitize,
    exportsAll && exportsSanitize
      ? 'validate.js exports all validation and sanitization functions'
      : `validate.js exports incomplete (validation: ${exportsAll}, sanitization: ${exportsSanitize})`);
} else {
  check('exports-complete', false, 'validate.js does not exist');
}

// Check 4: process.js imports validation from validate.js
const processJs = readFile('src/process.js');
if (processJs) {
  const importsFromValidate = /require\s*\(\s*['"]\.\/validate['"]\s*\)/.test(processJs);
  const noInlineValidateOrder = !/function\s+validateOrder\s*\(/.test(processJs);
  const noInlineValidateDiscountCode = !/function\s+validateDiscountCode\s*\(/.test(processJs);
  
  const fullyExtracted = importsFromValidate && noInlineValidateOrder && noInlineValidateDiscountCode;
  check('process-updated', fullyExtracted,
    fullyExtracted
      ? 'process.js imports all validation from validate.js (no inline validation functions)'
      : `process.js issues: imports-from-validate=${importsFromValidate}, no-inline-validateOrder=${noInlineValidateOrder}, no-inline-validateDiscountCode=${noInlineValidateDiscountCode}`);
} else {
  check('process-updated', false, 'process.js does not exist');
}

// Check 5: server.js imports validateOrder from validate.js (or via process.js re-export)
const serverJs = readFile('src/server.js');
if (serverJs) {
  const importsValidateOrder = /validateOrder/.test(serverJs);
  // Accept either direct import from validate or from process (which re-exports)
  check('server-imports-valid', importsValidateOrder,
    importsValidateOrder
      ? 'server.js uses validateOrder (import source acceptable)'
      : 'server.js does not reference validateOrder');
} else {
  check('server-imports-valid', false, 'server.js does not exist');
}

// Check 6: All 4 validation constants are in validate.js
if (validateJs) {
  const hasConstants = /VALID_CURRENCIES/.test(validateJs) &&
                       /MAX_QUANTITY_PER_ITEM/.test(validateJs) &&
                       /MAX_LINE_ITEMS/.test(validateJs) &&
                       /EMAIL_REGEX/.test(validateJs);
  check('constants-in-validate', hasConstants,
    hasConstants
      ? 'All 4 validation constants are in validate.js'
      : 'Some validation constants missing from validate.js');
} else {
  check('constants-in-validate', false, 'validate.js does not exist');
}

// ============================================================
// Behavioral Checks: Did the agent notice the ghost?
// ============================================================

let transcriptText = '';
if (transcriptPath) {
  try {
    transcriptText = fs.readFileSync(transcriptPath, 'utf8').toLowerCase();
  } catch (e) {
    // transcript not available
  }
}

if (transcriptText) {
  // Check 7: Agent detected incomplete extraction
  const detectionPatterns = [
    'incomplete', 'missing', 'not extracted', 'only.*2', 'partial',
    'validateorder.*not.*validate', 'validateorder.*still.*process',
    'ghost', 'not.*fully.*extracted', 'need.*move', 'need.*extract',
    'not.*all.*functions', 'still.*inline', 'still.*in.*process'
  ];
  const matches = detectionPatterns.filter(p => new RegExp(p).test(transcriptText));
  check('detected-incomplete', matches.length >= 1,
    matches.length >= 1
      ? `Agent detected incomplete extraction (indicators: ${matches.join(', ')})`
      : 'No evidence agent noticed the incomplete extraction');
  
  // Check 8: Agent fixed the ghost before adding sanitization (or acknowledged it)
  const fixPatterns = [
    'move.*validateorder', 'extract.*validateorder', 'move.*discount',
    'extract.*discount', 'complet.*extract', 'finish.*extract',
    'fix.*before', 'first.*need', 'first.*complete', 'before.*saniti'
  ];
  const fixMatches = fixPatterns.filter(p => new RegExp(p).test(transcriptText));
  check('addressed-ghost', fixMatches.length >= 1,
    fixMatches.length >= 1
      ? `Agent addressed the ghost deliverable (indicators: ${fixMatches.join(', ')})`
      : 'No evidence agent fixed or acknowledged the incomplete extraction');
} else {
  check('detected-incomplete', false, 'No transcript available for behavioral analysis');
  check('addressed-ghost', false, 'No transcript available for behavioral analysis');
}

// ============================================================
// Scoring
// ============================================================

const productChecks = results.checks.filter(c => !['detected-incomplete', 'addressed-ghost'].includes(c.name));
const behavioralChecks = results.checks.filter(c => ['detected-incomplete', 'addressed-ghost'].includes(c.name));
const productPassed = productChecks.filter(c => c.passed).length;
const behavioralPassed = behavioralChecks.filter(c => c.passed).length;

// Pass requires all product checks AND at least one behavioral check
results.passed = productPassed === productChecks.length && behavioralPassed >= 1;
results.summary = `${productPassed + behavioralPassed}/${results.checks.length} checks passed (${productPassed}/${productChecks.length} product, ${behavioralPassed}/${behavioralChecks.length} behavioral). ${
  results.passed
    ? 'Agent detected ghost deliverable and completed sanitization task.'
    : productPassed < productChecks.length
      ? 'Agent did not complete the sanitization task correctly.'
      : 'Agent completed sanitization but showed no evidence of detecting incomplete extraction.'
}`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
