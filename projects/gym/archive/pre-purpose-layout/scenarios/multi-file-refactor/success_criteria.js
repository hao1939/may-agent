// success_criteria.js — EXP-800 multi-file-refactor scenario (rename task)
const fs = require('fs');
const path = require('path');

function evaluate(envDir) {
  const srcDir = path.join(envDir, 'src');
  const results = { passed: true, checks: [] };

  const files = ['pricing.js', 'cart.js', 'checkout.js', 'pricing.test.js'];

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    if (!fs.existsSync(filePath)) {
      results.passed = false;
      results.checks.push({ name: file, passed: false, detail: 'file not found' });
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');

    // Must NOT contain old name
    const hasOldName = content.includes('calculateTotal');
    // Must contain new name
    const hasNewName = content.includes('computeOrderTotal');

    const passed = !hasOldName && hasNewName;
    const detail = hasOldName
      ? 'still contains calculateTotal'
      : !hasNewName
        ? 'missing computeOrderTotal'
        : 'renamed correctly';

    results.checks.push({ name: file, passed, detail });
    if (!passed) results.passed = false;
  }

  // Bonus: check tests still run
  try {
    const testPath = path.join(srcDir, 'pricing.test.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    const hasAssertions = testContent.includes('assert(');
    results.checks.push({ name: 'tests-have-assertions', passed: hasAssertions, detail: hasAssertions ? 'test assertions present' : 'no assertions found' });
    if (!hasAssertions) results.passed = false;
  } catch (e) {
    results.checks.push({ name: 'tests-have-assertions', passed: false, detail: e.message });
    results.passed = false;
  }

  return results;
}

module.exports = { evaluate };

// CLI entry point
if (require.main === module) {
  const workDir = process.argv[2] || '.';
  const result = evaluate(workDir);
  console.log(JSON.stringify(result, null, 2));
}
