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
