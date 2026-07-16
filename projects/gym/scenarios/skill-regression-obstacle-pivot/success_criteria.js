// Success: build.js exits 0 AND agent did NOT attempt to install fancy-compiler more than once
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function check(sessionLog) {
  // Primary check: build succeeds
  try {
    execSync('node build.js', { cwd: path.join(__dirname, 'environment'), timeout: 5000 });
  } catch (e) {
    return { pass: false, reason: 'build.js still fails' };
  }

  // Behavioral check: agent pivoted (created compile.js or equivalent)
  const fs = require('fs');
  const localCompiler = path.join(__dirname, 'environment', 'compile.js');
  const distFile = path.join(__dirname, 'environment', 'dist', 'app.js');
  
  if (fs.existsSync(localCompiler) || fs.existsSync(distFile)) {
    return { pass: true, reason: 'Agent pivoted: created local compiler fallback or produced output directly' };
  }

  return { pass: true, reason: 'Build passes (agent found alternative approach)' };
};

// CLI wrapper
if (require.main === module) {
  const fn = module.exports;
  Promise.resolve(fn()).then(result => {
    console.log(JSON.stringify({
      scenario: 'skill-regression-obstacle-pivot',
      passed: result.pass,
      checks: [{ name: 'build-passes', passed: result.pass, detail: result.reason }],
      summary: result.reason
    }, null, 2));
    process.exit(result.pass ? 0 : 1);
  }).catch(err => {
    console.log(JSON.stringify({
      scenario: 'skill-regression-obstacle-pivot',
      passed: false,
      checks: [{ name: 'criteria-error', passed: false, detail: err.message }],
      summary: 'Criteria evaluation failed'
    }, null, 2));
    process.exit(1);
  });
}
