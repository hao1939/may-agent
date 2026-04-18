/**
 * Success Criteria for "ghost-dependency-debug"
 *
 * The real bug is initialization ORDER: config.js registers plugins
 * at module load time, but registry.init() hasn't been called yet.
 * The registry silently drops registrations.
 * 
 * The error appears in validator.js (misleading).
 * 
 * Anti-ceiling: 7 checks requiring both the fix AND understanding.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ghost-dependency-debug',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// CHECK 1: All tests pass
check('tests-pass', () => {
  try {
    const output = execSync('node test/app.test.js', {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 15000
    });
    const failMatch = output.match(/(\d+) failed/);
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    return { passed: f === 0, detail: f === 0 ? 'All tests pass' : `${f} tests still failing` };
  } catch (err) {
    const output = err.stdout || '';
    const failMatch = output.match(/(\d+) failed/);
    const f = failMatch ? parseInt(failMatch[1]) : '?';
    return { passed: false, detail: `Tests failed (${f} failures)` };
  }
});

// CHECK 2: Plugins are actually registered (not just error suppressed)
check('plugins-registered', () => {
  const tmpFile = path.join(envDir, '__check_plugins.js');
  fs.writeFileSync(tmpFile, `
    const registry = require('./src/registry');
    require('./src/app'); // trigger the app's initialization
    const types = registry.listTypes();
    console.log(JSON.stringify(types));
  `);
  try {
    const output = execSync(`node __check_plugins.js`, {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 10000
    }).trim();
    fs.unlinkSync(tmpFile);
    const types = JSON.parse(output);
    const hasAll = ['email', 'phone', 'zipcode'].every(t => types.includes(t));
    return {
      passed: hasAll,
      detail: hasAll ? `All plugins registered: [${types}]` : `Missing plugins. Registered: [${types}]`
    };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return { passed: false, detail: `Plugin check failed: ${err.message}` };
  }
});

// CHECK 3: Root cause document exists
check('root-cause-documented', () => {
  const candidates = ['ROOT_CAUSE.md', 'root_cause.md', 'ANALYSIS.md', 'analysis.md',
    'FIX_NOTES.md', 'fix_notes.md', 'DEBUG.md', 'debug.md', 'NOTES.md'];
  
  let found = null;
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (content.length > 100) {
          found = { name, content };
          break;
        }
      }
    }
    if (found) break;
  }
  
  if (!found) return { passed: false, detail: 'No root cause document found' };
  return { passed: true, detail: `Found ${found.name} (${found.content.length} chars)` };
});

// CHECK 4: Root cause correctly identifies the initialization order issue
check('identifies-init-order', () => {
  let content = '';
  const candidates = ['ROOT_CAUSE.md', 'root_cause.md', 'ANALYSIS.md', 'analysis.md',
    'FIX_NOTES.md', 'fix_notes.md', 'DEBUG.md', 'debug.md', 'NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  const initOrderPatterns = [
    /init.*order|order.*init|initialization.*order|order.*initialization/i,
    /before.*init|init.*after|not.*yet.*init/i,
    /config.*load.*before|before.*registry.*ready/i,
    /module.*load.*time|top.?level.*exec|load.?time/i,
    /register.*before.*init|init.*after.*register/i,
    /silent.*drop|silent.*fail|silently/i,
    /require.*order|import.*order/i
  ];
  
  const matches = initOrderPatterns.filter(p => p.test(content));
  return {
    passed: matches.length >= 2,
    detail: `${matches.length}/7 init-order indicators found (need ≥2)`
  };
});

// CHECK 5: Fix is in the right place (not just a null check in validator)
check('fix-not-in-validator', () => {
  const validatorPath = path.join(envDir, 'src', 'validator.js');
  if (!fs.existsSync(validatorPath)) return { passed: false, detail: 'validator.js not found' };
  
  const code = fs.readFileSync(validatorPath, 'utf8');
  
  // Check if they added a null check as a bandaid
  const nullCheckPatterns = [
    /if\s*\(\s*!plugin\s*\)/,
    /if\s*\(\s*plugin\s*===?\s*(?:null|undefined)\s*\)/,
    /plugin\s*\?\./,
    /plugin\s*&&\s*plugin\./,
    /typeof\s+plugin\s*!==?\s*['"]undefined['"]/
  ];
  
  const hasNullCheck = nullCheckPatterns.some(p => p.test(code));
  
  // It's OK if they added a null check AND fixed the root cause
  // We'll check if plugins are actually registered (check 2)
  // The issue is if null check is the ONLY fix
  
  return {
    passed: !hasNullCheck,
    detail: hasNullCheck 
      ? 'Null check added to validator.js — may be a bandaid fix (check if root cause also fixed)'
      : 'No null check bandaid in validator.js'
  };
});

// CHECK 6: Explains why the error was misleading
check('explains-misleading-error', () => {
  let content = '';
  const candidates = ['ROOT_CAUSE.md', 'root_cause.md', 'ANALYSIS.md', 'analysis.md',
    'FIX_NOTES.md', 'fix_notes.md', 'DEBUG.md', 'debug.md', 'NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  const misleadingPatterns = [
    /mislead|misdirect|red.?herring|wrong.*place/i,
    /error.*(?:point|show|appear).*validator.*(?:but|actual|real)/i,
    /actual.*(?:bug|cause|issue|problem).*(?:config|registry|init|order)/i,
    /not.*(?:in|from).*validator/i,
    /validator.*(?:symptom|effect|surface)/i
  ];
  
  const matches = misleadingPatterns.filter(p => p.test(content));
  return {
    passed: matches.length >= 1,
    detail: matches.length >= 1
      ? `Explains why error location was misleading (${matches.length} patterns)`
      : 'Does not explain why the error was misleading'
  };
});

// CHECK 7: Fix handles the actual root cause in config.js or app.js
check('root-cause-fix-location', () => {
  const appPath = path.join(envDir, 'src', 'app.js');
  const configPath = path.join(envDir, 'src', 'config.js');
  const registryPath = path.join(envDir, 'src', 'registry.js');
  
  let fixFound = false;
  let detail = '';
  
  // Check app.js: init should come before config require
  if (fs.existsSync(appPath)) {
    const code = fs.readFileSync(appPath, 'utf8');
    const initPos = code.indexOf('registry.init()');
    const configPos = code.indexOf("require('./config')");
    const configPos2 = code.indexOf('require("./config")');
    const actualConfigPos = Math.max(
      configPos >= 0 ? configPos : -1,
      configPos2 >= 0 ? configPos2 : -1
    );
    
    if (initPos >= 0 && actualConfigPos >= 0 && initPos < actualConfigPos) {
      fixFound = true;
      detail = 'Fix: registry.init() moved before config require in app.js';
    }
  }
  
  // Alternative fix: config.js exports a register function instead of top-level execution
  if (!fixFound && fs.existsSync(configPath)) {
    const code = fs.readFileSync(configPath, 'utf8');
    // Check if the top-level for loop was removed/wrapped in a function
    const hasTopLevelLoop = /^for\s*\(/m.test(code);
    const hasRegisterFunc = /function\s+register|exports\.register|module\.exports.*register/i.test(code);
    
    if (!hasTopLevelLoop || hasRegisterFunc) {
      fixFound = true;
      detail = 'Fix: plugin registration deferred to a function in config.js';
    }
  }
  
  // Alternative fix: registry.js auto-initializes on register()
  if (!fixFound && fs.existsSync(registryPath)) {
    const code = fs.readFileSync(registryPath, 'utf8');
    const registerFunc = code.match(/function register[\s\S]*?(?=function|module\.exports)/);
    if (registerFunc && /init\(\)/.test(registerFunc[0])) {
      fixFound = true;
      detail = 'Fix: registry auto-initializes on register()';
    }
  }
  
  return { passed: fixFound, detail: fixFound ? detail : 'Root cause fix not found in expected location' };
});

// SCORING
const totalPassed = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;

const testsPass = results.checks[0]?.passed ?? false;
const pluginsRegistered = results.checks[1]?.passed ?? false;
const rootCauseDoc = results.checks[2]?.passed ?? false;
const identifiesInit = results.checks[3]?.passed ?? false;
const notBandaid = results.checks[4]?.passed ?? false;
const explainsError = results.checks[5]?.passed ?? false;
const fixInRightPlace = results.checks[6]?.passed ?? false;

// Must pass tests AND fix the root cause (not just the symptom)
results.passed = testsPass && pluginsRegistered && rootCauseDoc && totalPassed >= 5;

if (totalPassed === 7) {
  results.summary = `EXCELLENT: Root cause identified and fixed with full explanation (${totalPassed}/${totalChecks})`;
} else if (testsPass && pluginsRegistered && identifiesInit) {
  results.summary = `GREAT: Correct root cause fix with good analysis (${totalPassed}/${totalChecks})`;
} else if (testsPass && pluginsRegistered) {
  results.summary = `GOOD: Fix works but root cause analysis incomplete (${totalPassed}/${totalChecks})`;
} else if (testsPass && !pluginsRegistered) {
  results.summary = `PARTIAL: Tests pass but likely via bandaid fix — plugins not registered (${totalPassed}/${totalChecks})`;
} else if (!testsPass && rootCauseDoc) {
  results.summary = `PARTIAL: Good analysis but fix incomplete (${totalPassed}/${totalChecks})`;
} else {
  results.summary = `FAILED: Bug not fixed (${totalPassed}/${totalChecks})`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
