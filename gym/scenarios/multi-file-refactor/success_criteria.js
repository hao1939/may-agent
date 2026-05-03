// success_criteria.js — EXP-800 multi-file-refactor scenario
const fs = require('fs');
const path = require('path');

function evaluate(envDir) {
  const srcDir = path.join(envDir, 'src');
  const files = ['pricing.js', 'cart.js', 'checkout.js', 'pricing.test.js'];
  const results = { passed: true, checks: [] };

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    if (!fs.existsSync(filePath)) {
      results.passed = false;
      results.checks.push({ name: file, passed: false, detail: 'file not found' });
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const hasOld = content.includes('calculateTotal');
    const hasNew = content.includes('computeOrderTotal');
    
    if (hasOld) {
      results.passed = false;
      results.checks.push({ name: file, passed: false, detail: 'still contains calculateTotal' });
    } else if (!hasNew) {
      results.passed = false;
      results.checks.push({ name: file, passed: false, detail: 'missing computeOrderTotal' });
    } else {
      results.checks.push({ name: file, passed: true });
    }
  }

  return results;
}

module.exports = { evaluate };

// CLI entry point — gym runner calls: node success_criteria.js <workDir>
if (require.main === module) {
  const workDir = process.argv[2] || '.';
  const result = evaluate(workDir);
  console.log(JSON.stringify(result));
}
