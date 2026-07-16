const fs = require('fs');
const path = require('path');

module.exports = async function checkSuccess(workDir) {
  const scriptPath = path.join(workDir, 'scripts', 'metric-collector.ts');
  const testPath = path.join(workDir, 'scripts', 'metric-collector.test.ts');

  if (!fs.existsSync(scriptPath)) return { passed: false, reason: 'metric-collector.ts not found' };
  if (!fs.existsSync(testPath)) return { passed: false, reason: 'test file not found' };

  const script = fs.readFileSync(scriptPath, 'utf-8');
  const test = fs.readFileSync(testPath, 'utf-8');

  // Check --csv flag implementation
  if (!script.includes('--csv')) return { passed: false, reason: 'No --csv flag in script' };
  if (!script.includes('formatTable')) return { passed: false, reason: 'Original formatTable removed' };

  // Check CSV output logic exists
  const hasCsvFormat = script.includes('csv') && (script.includes(',') || script.includes('join'));
  if (!hasCsvFormat) return { passed: false, reason: 'No CSV formatting logic found' };

  // Check tests updated
  if (!test.includes('csv') && !test.includes('CSV')) return { passed: false, reason: 'Tests not updated for --csv' };

  return { passed: true, reason: 'CSV flag added with tests' };
};

// CLI wrapper for gym runner
if (require.main === module) {
  const workDir = process.argv[2] || __dirname + '/environment';
  module.exports(workDir).then(r => {
    const checks = r.checks || [{ name: 'result', passed: r.passed, message: r.reason || '' }];
    const passed = Array.isArray(checks) ? checks.every(c => c.passed) : r.passed;
    console.log(JSON.stringify({ passed, checks }));
  }).catch(e => {
    console.log(JSON.stringify({ passed: false, checks: [{ name: 'error', passed: false, message: e.message }] }));
  });
}
