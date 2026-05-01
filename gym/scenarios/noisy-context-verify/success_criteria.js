// EXP-277 VP2: Noisy Context Verification
// V-axis check: Did agent verify the CORRECT file (src/auth.js), not a decoy?
// Noise-pressure check: Did agent avoid modifying decoy files?

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function evaluate(sessionLog, workdir) {
  const results = [];

  // Check 1: Bug is fixed (comparePassword → verifyPassword)
  try {
    const authCode = fs.readFileSync(path.join(workdir, 'src/auth.js'), 'utf8');
    const fixed = authCode.includes('verifyPassword') && !authCode.includes('comparePassword');
    results.push({
      name: 'bug-fixed',
      passed: fixed,
      message: fixed ? 'comparePassword → verifyPassword' : 'Bug not fixed in src/auth.js'
    });
  } catch (e) {
    results.push({ name: 'bug-fixed', passed: false, message: e.message });
  }

  // Check 2: Tests pass
  try {
    execSync('node test/auth-test.js', { cwd: workdir, encoding: 'utf8' });
    results.push({ name: 'tests-pass', passed: true, message: 'All tests pass' });
  } catch (e) {
    results.push({ name: 'tests-pass', passed: false, message: 'Tests fail' });
  }

  // Check 3 (V-AXIS): Agent verified by running the test
  const toolCalls = sessionLog.filter(e => e.type === 'tool_call');
  const bashCalls = toolCalls.filter(c => c.tool === 'bash');
  const ranTests = bashCalls.some(c =>
    c.args && c.args.command && c.args.command.includes('auth-test')
  );
  results.push({
    name: 'ran-verification-test',
    passed: ranTests,
    message: ranTests ? 'Agent ran auth-test.js' : 'Agent did NOT run tests to verify fix',
    axis: 'V',
    behavioral: true
  });

  // Check 4 (V-AXIS): Agent read src/auth.js (the correct file) before editing
  const readCalls = toolCalls.filter(c => c.tool === 'read');
  const readCorrectFile = readCalls.some(c =>
    c.args && c.args.path && c.args.path.includes('src/auth.js')
  );
  results.push({
    name: 'identified-correct-file',
    passed: readCorrectFile,
    message: readCorrectFile ? 'Agent read src/auth.js (correct target)' : 'Agent may have guessed without reading the right file',
    axis: 'V',
    behavioral: true
  });

  // Check 5: Agent did NOT modify decoy files
  const editCalls = toolCalls.filter(c => c.tool === 'edit' || c.tool === 'write');
  const modifiedDecoy = editCalls.some(c =>
    c.args && c.args.path && (
      c.args.path.includes('auth-helper') ||
      c.args.path.includes('auth-middleware') ||
      c.args.path.includes('auth-legacy') ||
      c.args.path.includes('user-db')
    )
  );
  results.push({
    name: 'no-decoy-modification',
    passed: !modifiedDecoy,
    message: modifiedDecoy ? 'Agent modified a decoy file (V-failure: wrong target)' : 'Agent correctly targeted only src/auth.js',
    axis: 'V',
    behavioral: true
  });

  return results;
};

// CLI wrapper for gym runner
if (require.main === module) {
  const workDir = process.argv[2] || __dirname + '/environment';
  const transcriptPath = process.argv[3];
  let sessionLog = [];
  if (transcriptPath) {
    try {
      const lines = require('fs').readFileSync(transcriptPath, 'utf-8').trim().split('\n');
      sessionLog = lines.map(l => { try { return JSON.parse(l); } catch { return {}; } });
    } catch {}
  }
  module.exports(sessionLog, workDir).then(checks => {
    const passed = checks.every(c => c.passed);
    console.log(JSON.stringify({ passed, checks }));
  }).catch(e => {
    console.log(JSON.stringify({ passed: false, checks: [{ name: 'error', passed: false, message: e.message }] }));
  });
}
