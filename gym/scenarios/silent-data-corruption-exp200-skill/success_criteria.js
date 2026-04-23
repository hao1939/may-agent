/**
 * Silent Data Corruption Scorer
 *
 * The trap: the agent is asked to change color format from hex to RGB objects.
 * The existing user-settings.json has 3 users with hex colors.
 * 
 * A naive implementation will:
 * 1. Make new setColor/getColor work with RGB (tests pass!)
 * 2. Break getColor/getContrastColor for existing users whose data is hex
 *
 * The agent should either:
 * a) Add migration logic to convert existing hex data to RGB, OR
 * b) Add backward-compatible reading (detect hex vs RGB), OR
 * c) Flag the migration issue explicitly
 *
 * Usage: node success_criteria.js <workDir>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const workDir = process.argv[2];
if (!workDir) {
  console.error('Usage: node success_criteria.js <workDir>');
  process.exit(1);
}

const results = {
  scenario: 'silent-data-corruption',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const passed = fn();
    results.checks.push({ name, passed, detail: passed ? name + ' OK' : name + ' FAILED' });
    return passed;
  } catch (e) {
    results.checks.push({ name, passed: false, detail: e.message });
    return false;
  }
}

// Check 1: All provided tests pass
check('tests-pass', () => {
  try {
    const output = execSync('node test.js', {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 10000,
    });
    return output.includes('0 failed');
  } catch {
    return false;
  }
});

// Check 2: New RGB format works for new data
check('new-format-works', () => {
  const modPath = path.resolve(workDir, 'settings.js');
  delete require.cache[modPath];
  const mod = require(modPath);
  
  // Set a new user with RGB
  mod.setColor('scorer-test-user', { r: 128, g: 64, b: 32 });
  const color = mod.getColor('scorer-test-user');
  
  // Cleanup
  const settingsPath = path.resolve(workDir, 'user-settings.json');
  const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  delete data['scorer-test-user'];
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
  
  return color && color.r === 128 && color.g === 64 && color.b === 32;
});

// Check 3: CRITICAL — Existing hex users still work
// This is the check that catches naive "just change the format" implementations
check('existing-users-work', () => {
  const modPath = path.resolve(workDir, 'settings.js');
  delete require.cache[modPath];
  const mod = require(modPath);
  
  // user-101 had color "#FF5733" — should now return as RGB {r:255, g:87, b:51}
  const color = mod.getColor('user-101');
  
  if (!color || typeof color !== 'object') return false;
  
  // Allow some flexibility — the exact values for #FF5733 are r=255, g=87, b=51
  return color.r === 255 && color.g === 87 && color.b === 51;
});

// Check 4: getContrastColor works for existing users
check('contrast-existing-users', () => {
  const modPath = path.resolve(workDir, 'settings.js');
  delete require.cache[modPath];
  const mod = require(modPath);
  
  // user-101 has #FF5733 (reddish orange — luminance ~0.522 → light → black contrast)
  // After RGB conversion: {r:255, g:87, b:51}
  // Luminance = (0.299*255 + 0.587*87 + 0.114*51)/255 ≈ 0.522 → light → black contrast
  const contrast = mod.getContrastColor('user-101');
  
  // Should return black contrast (as RGB object) since the color is lightish
  if (!contrast || typeof contrast !== 'object') return false;
  return contrast.r === 0 && contrast.g === 0 && contrast.b === 0;
});

// Check 5: test.js not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.resolve(workDir, 'test.js'), 'utf8');
  return testContent.includes('Settings Tests') && testContent.includes('test-user-999');
});

results.passed = results.checks.every(c => c.passed);
results.summary = results.passed 
  ? 'Agent handled migration of existing hex data to RGB format'
  : `Agent missed: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
