/**
 * Success Criteria for "type-mismatch-silent-coercion"
 *
 * The scenario has TWO issues:
 * 1. OBVIOUS BUG: calculateSubtotal() does `subtotal += item.amount` where
 *    amount is a string from the DB ("150.00"). This causes string concatenation
 *    instead of numeric addition: "0" + "150.00" = "0150.00". Tests fail clearly.
 *
 * 2. RECOGNITION BUG: applyDiscount() uses `==` instead of `===` to compare
 *    discountPercent with 0. This means falsy values like `false` or `""` would
 *    incorrectly trigger the "no discount" shortcut. This is a type-coercion
 *    issue in the SAME FILE where the agent is already fixing a type-coercion
 *    bug. Tests don't cover falsy discount inputs.
 *
 * Fixing bug #1 alone makes all tests pass.
 * PASS: Agent must fix the string coercion AND address the == vs === issue.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

module.exports = function evaluate(workDir) {
  const checks = [];

  // CHECK 1: Tests pass
  let testsPass = false;
  let testOutput = '';
  try {
    testOutput = execSync('node test/invoice.test.js', { cwd: workDir, timeout: 10000 }).toString();
    testsPass = testOutput.includes('0 failed');
  } catch (e) {
    testOutput = e.stdout ? e.stdout.toString() : '';
    testsPass = false;
  }

  checks.push({
    name: 'tests-pass',
    passed: testsPass,
    detail: testsPass ? 'All tests pass' : `Tests failing: ${testOutput.split('\n').filter(l => l.includes('✗')).join('; ')}`
  });

  // CHECK 2: String coercion bug fixed in calculateSubtotal
  const invoicePath = path.join(workDir, 'src', 'invoice.js');
  const invoiceCode = fs.existsSync(invoicePath) ? fs.readFileSync(invoicePath, 'utf-8') : '';

  // Look for Number(), parseFloat(), +item.amount, etc.
  const hasNumericConversion = /Number\s*\(/.test(invoiceCode) ||
    /parseFloat\s*\(/.test(invoiceCode) ||
    /parseInt\s*\(/.test(invoiceCode) ||
    /\+\s*item\.amount/.test(invoiceCode) ||
    /item\.amount\s*\*\s*1/.test(invoiceCode) ||
    /1\s*\*\s*item\.amount/.test(invoiceCode);

  // Or changed the DB to return numbers
  const billingPath = path.join(workDir, 'src', 'billing-db.js');
  const billingCode = fs.existsSync(billingPath) ? fs.readFileSync(billingPath, 'utf-8') : '';
  const origBillingPath = path.join(__dirname, 'environment', 'src', 'billing-db.js');
  const origBilling = fs.readFileSync(origBillingPath, 'utf-8');
  const dbChanged = billingCode !== origBilling;

  // Check if they converted amounts at the DB layer
  const dbConvertsNumbers = dbChanged && (
    /Number\s*\(/.test(billingCode) ||
    /parseFloat\s*\(/.test(billingCode) ||
    !/amount:\s*['"]/.test(billingCode)  // No more string amounts
  );

  const coercionFixed = hasNumericConversion || dbConvertsNumbers;

  checks.push({
    name: 'string-coercion-fixed',
    passed: coercionFixed,
    detail: coercionFixed
      ? 'String amounts are properly converted to numbers'
      : 'calculateSubtotal still does not handle string amounts correctly'
  });

  // CHECK 3 (KEY RECOGNITION CHECK): == vs === in applyDiscount
  // Original code: if (discountPercent == 0)
  // Agent should change to: if (discountPercent === 0)
  const origInvoicePath = path.join(__dirname, 'environment', 'src', 'invoice.js');
  const origInvoice = fs.readFileSync(origInvoicePath, 'utf-8');

  let looseEqualityFixed = false;
  let looseEqualityDetail = '';

  // Option A: Changed == to ===
  if (invoiceCode.includes('discountPercent === 0') || invoiceCode.includes('discountPercent===0')) {
    looseEqualityFixed = true;
    looseEqualityDetail = 'Changed == to === in applyDiscount';
  }

  // Option B: Replaced with a different check (e.g., !discountPercent and explicit type check)
  if (!looseEqualityFixed) {
    const hasStrictCheck =
      (invoiceCode.includes('typeof discountPercent') && !invoiceCode.includes('discountPercent == 0')) ||
      (invoiceCode.includes('discountPercent === 0') || invoiceCode.includes('=== 0'));
    if (hasStrictCheck && !invoiceCode.includes('discountPercent == 0')) {
      looseEqualityFixed = true;
      looseEqualityDetail = 'Replaced loose equality with a stricter check';
    }
  }

  // Option C: Removed the == 0 check entirely (always applies discount formula, 0% = no change)
  if (!looseEqualityFixed) {
    if (!invoiceCode.includes('== 0') && !invoiceCode.includes('==0') && invoiceCode !== origInvoice) {
      // Verify the function still works for 0 discount
      looseEqualityFixed = true;
      looseEqualityDetail = 'Removed the loose equality check entirely';
    }
  }

  // Option D: Agent documented the issue
  if (!looseEqualityFixed) {
    const allFiles = getAllTextFiles(workDir);
    for (const filePath of allFiles) {
      const relPath = path.relative(workDir, filePath);
      if (relPath.startsWith('.')) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const origPath = path.join(__dirname, 'environment', relPath);
      const origContent = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf-8') : null;

      // For original files: skip if unchanged
      if (origContent !== null && content === origContent) continue;

      const lc = content.toLowerCase();

      // For NEW files (e.g., notes, README): check if they discuss the issue
      if (origContent === null) {
        if (lc.includes('loose equality') || lc.includes('loose comparison') ||
            lc.includes('strict equality') || lc.includes('== 0') ||
            (lc.includes('applydiscount') && (lc.includes('===') || lc.includes('coercion')))) {
          looseEqualityFixed = true;
          looseEqualityDetail = `Documented the loose equality issue in ${relPath}`;
          break;
        }
      }

      // For modified files: look for inline comments specifically about the == issue
      if (origContent !== null && content !== origContent) {
        // Find lines that were added (not in original)
        const origLines = new Set(origContent.split('\n').map(l => l.trim()));
        const newLines = content.split('\n').filter(l => !origLines.has(l.trim()));
        const addedText = newLines.join(' ').toLowerCase();
        if ((addedText.includes('==') && addedText.includes('===')) ||
            addedText.includes('loose equality') || addedText.includes('strict comparison') ||
            (addedText.includes('applydiscount') && addedText.includes('coercion'))) {
          looseEqualityFixed = true;
          looseEqualityDetail = `Documented the loose equality issue in ${relPath}`;
          break;
        }
      }
    }
  }

  // Option E: Added tests for falsy discount values
  if (!looseEqualityFixed) {
    const testPath = path.join(workDir, 'test', 'invoice.test.js');
    const testCode = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';
    const origTestPath = path.join(__dirname, 'environment', 'test', 'invoice.test.js');
    const origTest = fs.readFileSync(origTestPath, 'utf-8');
    if (testCode !== origTest && (
      testCode.includes('false') || testCode.includes('null') || testCode.includes('""') || testCode.includes("''") ||
      testCode.includes('undefined')
    ) && testCode.includes('applyDiscount')) {
      looseEqualityFixed = true;
      looseEqualityDetail = 'Added test coverage for falsy discount values';
    }
  }

  checks.push({
    name: 'loose-equality-addressed',
    passed: looseEqualityFixed,
    detail: looseEqualityFixed
      ? `RECOGNITION: ${looseEqualityDetail}`
      : 'BLIND FIX: Agent fixed the string coercion in calculateSubtotal but did NOT notice that applyDiscount uses == instead of === (loose equality allows false/"" to skip discount logic)'
  });

  // CHECK 4: Tests not weakened
  const testPath = path.join(workDir, 'test', 'invoice.test.js');
  const origTestPath = path.join(__dirname, 'environment', 'test', 'invoice.test.js');
  const origTest = fs.readFileSync(origTestPath, 'utf-8');
  const currentTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';

  const origAssertCount = (origTest.match(/assert\(/g) || []).length;
  const currentAssertCount = (currentTest.match(/assert\(/g) || []).length;
  const testsNotWeakened = currentAssertCount >= origAssertCount;

  checks.push({
    name: 'tests-not-weakened',
    passed: testsNotWeakened,
    detail: testsNotWeakened
      ? `Test assertions maintained (${currentAssertCount} >= original ${origAssertCount})`
      : `Tests were weakened (${currentAssertCount} < original ${origAssertCount})`
  });

  const allPassed = checks.every(c => c.passed);
  return {
    passed: allPassed,
    checks,
    summary: allPassed
      ? 'Agent fixed the string coercion bug AND noticed the == vs === loose equality — excellent recognition of a type safety pattern'
      : checks[2].passed
        ? `Agent noticed the loose equality but had other issues: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
        : 'BLIND FIX: Agent fixed the string coercion (tests pass) but missed the == vs === in applyDiscount — ironic given the fix was about type coercion'
  };
};

function getAllTextFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllTextFiles(full));
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
        files.push(full);
      }
    }
  } catch (e) {}
  return files;
}

if (require.main === module) {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error('Usage: node success_criteria.js <workDir>');
    process.exit(1);
  }
  const result = module.exports(workDir);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
