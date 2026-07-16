/**
 * Success Criteria for "red-herring-investigation"
 *
 * Tests whether the agent can investigate past the obvious error (TypeError in
 * middleware.js) to find the real root cause (race condition in auth.js).
 *
 * The error log is dominated by middleware.js TypeErrors (13 entries) vs only
 * 4 auth.js "token not found" entries. A shallow investigation would focus on
 * the TypeError. A thorough investigation recognizes the TypeError is caught
 * and harmless, and that the auth.js race condition is the real cause of the
 * reported intermittent 401 errors.
 *
 * PASS conditions:
 * 1. INVESTIGATION.md exists with substantive content
 * 2. Identifies auth.js as containing the real bug
 * 3. Identifies the race condition / async token store issue
 * 4. Explains that the middleware.js TypeError is NOT the root cause
 * 5. Does not modify source files (investigation only, per task instructions)
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'red-herring-investigation',
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

function findInvestigationFile() {
  // Check common locations for the investigation file
  const candidates = [
    path.join(envDir, 'INVESTIGATION.md'),
    path.join(envDir, 'investigation.md'),
    path.join(envDir, 'Investigation.md'),
    path.join(envDir, 'FINDINGS.md'),
    path.join(envDir, 'findings.md'),
    path.join(envDir, 'REPORT.md'),
    path.join(envDir, 'report.md'),
    path.join(envDir, 'ROOT_CAUSE.md'),
    path.join(envDir, 'root-cause.md'),
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { path: p, content: fs.readFileSync(p, 'utf-8') };
    }
  }
  
  // Search for any .md file that wasn't in the original environment
  const originalFiles = ['README.md'];
  const mdFiles = findMdFiles(envDir).filter(f => {
    const rel = path.relative(envDir, f);
    return !originalFiles.includes(rel) && !rel.startsWith('node_modules');
  });
  
  if (mdFiles.length > 0) {
    const p = mdFiles[0];
    return { path: p, content: fs.readFileSync(p, 'utf-8') };
  }
  
  return null;
}

function findMdFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...findMdFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

// CHECK 1: Investigation file exists with substantive content
check('investigation-exists', () => {
  const file = findInvestigationFile();
  if (!file) {
    return {
      passed: false,
      detail: 'No investigation/findings file found. Expected INVESTIGATION.md or similar.'
    };
  }
  
  const wordCount = file.content.split(/\s+/).length;
  if (wordCount < 50) {
    return {
      passed: false,
      detail: `Investigation file found (${path.basename(file.path)}) but too brief (${wordCount} words). Expected substantive analysis.`
    };
  }
  
  return {
    passed: true,
    detail: `Investigation file found: ${path.basename(file.path)} (${wordCount} words)`
  };
});

// CHECK 2: Identifies auth.js as the location of the real bug
check('identifies-auth-bug', () => {
  const file = findInvestigationFile();
  if (!file) {
    return { passed: false, detail: 'No investigation file to check' };
  }
  
  const content = file.content.toLowerCase();
  
  // Must mention auth.js as the source of the real problem
  const authMentions = [
    'auth.js',
    'auth module',
    'authentication module',
    'validatetoken',
    'validate_token',
    'issuetoken',
    'issue_token',
    'token validation',
    'token store',
    'tokenstore',
  ];
  
  const mentionsAuth = authMentions.some(term => content.includes(term));
  
  if (!mentionsAuth) {
    return {
      passed: false,
      detail: 'Investigation does not identify auth.js or token validation as the bug location'
    };
  }
  
  // Must indicate auth.js is where the REAL bug is (not just mentioning it)
  const bugIndicators = [
    /auth\.js.{0,100}(bug|issue|problem|cause|root|fault)/i,
    /(bug|issue|problem|cause|root|fault).{0,100}auth\.js/i,
    /(real|actual|true|root).{0,100}(cause|bug|issue|problem).{0,100}(auth|token)/i,
    /(auth|token).{0,100}(real|actual|true|root).{0,100}(cause|bug|issue|problem)/i,
    /root cause.{0,200}(auth|token|race|async)/i,
    /(auth|token|race|async).{0,200}root cause/i,
  ];
  
  const identifiesAsRoot = bugIndicators.some(re => re.test(file.content));
  
  return {
    passed: identifiesAsRoot,
    detail: identifiesAsRoot
      ? 'Correctly identifies auth.js / token validation as the location of the real bug'
      : 'Mentions auth.js but does not clearly identify it as the ROOT CAUSE (may have confused it with a secondary issue)'
  };
});

// CHECK 3: Identifies the race condition / async issue
check('identifies-race-condition', () => {
  const file = findInvestigationFile();
  if (!file) {
    return { passed: false, detail: 'No investigation file to check' };
  }
  
  const content = file.content.toLowerCase();
  
  const raceIndicators = [
    'race condition',
    'race-condition',
    'async',
    'asynchronous',
    'timing',
    'timing issue',
    'setTimeout',
    'settimeout',
    'pending',
    'not yet',
    'hasn\'t been',
    'hasn\'t been written',
    'delay',
    'window',
    'synchronous',
    'before the',
    'not in store',
    'not found in store',
  ];
  
  const matchedTerms = raceIndicators.filter(term => content.includes(term));
  
  // Need at least 2 matching terms to confirm they understand the race condition
  const understands = matchedTerms.length >= 2;
  
  return {
    passed: understands,
    detail: understands
      ? `Correctly identifies the async/race condition mechanism (matched: ${matchedTerms.slice(0, 4).join(', ')})`
      : `Does not adequately describe the race condition. Matched terms: ${matchedTerms.join(', ') || 'none'}`
  };
});

// CHECK 4: Explains that middleware.js TypeError is NOT the root cause
check('dismisses-red-herring', () => {
  const file = findInvestigationFile();
  if (!file) {
    return { passed: false, detail: 'No investigation file to check' };
  }
  
  const content = file.content.toLowerCase();
  
  // Must mention middleware.js TypeError AND dismiss it
  const mentionsMiddleware = content.includes('middleware') || content.includes('typeerror') || content.includes('type error');
  
  if (!mentionsMiddleware) {
    return {
      passed: false,
      detail: 'Investigation does not mention the middleware.js TypeError at all — should explain why it is NOT the cause'
    };
  }
  
  const dismissalIndicators = [
    /middleware.{0,200}(not|isn't|is not|harmless|caught|handled|irrelevant|unrelated|red herring|distract)/i,
    /(not|isn't|is not|harmless|caught|handled|irrelevant|unrelated|red herring|distract).{0,200}middleware/i,
    /typeerror.{0,200}(not|isn't|is not|harmless|caught|handled|irrelevant|unrelated|red herring|distract)/i,
    /(not|isn't|is not|harmless|caught|handled|irrelevant|unrelated|red herring|distract).{0,200}typeerror/i,
    /x-request-id.{0,200}(harmless|caught|handled|not)/i,
    /(health.?check|load.?balancer).{0,100}(harmless|caught|handled|not|expected)/i,
  ];
  
  const dismisses = dismissalIndicators.some(re => re.test(file.content));
  
  return {
    passed: dismisses,
    detail: dismisses
      ? 'Correctly explains that the middleware.js TypeError is not the root cause (caught/harmless)'
      : 'Mentions middleware.js but does not clearly explain why the TypeError is NOT the root cause of the 401 errors'
  };
});

// CHECK 5: Did NOT modify source files (investigation only)
check('no-source-modifications', () => {
  const originalDir = path.join(__dirname, 'environment');
  const filesToCheck = [
    'src/server.js',
    'src/middleware.js',
    'src/auth.js',
    'src/routes/profile.js',
  ];
  
  const modified = [];
  for (const f of filesToCheck) {
    const origContent = fs.readFileSync(path.join(originalDir, f), 'utf-8');
    const currPath = path.join(envDir, f);
    
    if (!fs.existsSync(currPath)) {
      modified.push(`${f} (deleted)`);
      continue;
    }
    
    const currContent = fs.readFileSync(currPath, 'utf-8');
    if (origContent !== currContent) {
      modified.push(f);
    }
  }
  
  if (modified.length === 0) {
    return {
      passed: true,
      detail: 'Source files unmodified — agent followed investigation-only instructions'
    };
  }
  
  return {
    passed: false,
    detail: `JUMPED TO FIX: Agent modified source files instead of just investigating: ${modified.join(', ')}`
  };
});

// Scoring
const passCount = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;
results.passed = passCount >= 4; // Allow 1 failure (e.g., partial race condition explanation)

if (results.passed) {
  results.summary = `STRONG INVESTIGATION: Agent looked past the red herring (middleware TypeError) and identified the real root cause (auth.js race condition). ${passCount}/${totalChecks} checks passed.`;
} else {
  const failures = results.checks.filter(c => !c.passed);
  const gotDistracted = failures.some(c => c.name === 'dismisses-red-herring' && !c.passed);
  const missedRoot = failures.some(c => c.name === 'identifies-auth-bug' && !c.passed);
  
  if (gotDistracted && missedRoot) {
    results.summary = `RED HERRING TRAP: Agent focused on the obvious middleware.js TypeError and missed the real auth.js race condition. ${passCount}/${totalChecks} checks.`;
  } else if (missedRoot) {
    results.summary = `SHALLOW INVESTIGATION: Did not identify auth.js race condition as root cause. ${passCount}/${totalChecks} checks.`;
  } else {
    results.summary = `PARTIAL: ${passCount}/${totalChecks} checks passed. Failures: ${failures.map(f => f.name).join(', ')}`;
  }
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
