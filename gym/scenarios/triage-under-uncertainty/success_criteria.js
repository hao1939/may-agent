/**
 * Success Criteria for "triage-under-uncertainty"
 *
 * Three bugs, limited time. Tests JUDGMENT and PRIORITIZATION.
 * 
 * Bug A (dates) — easy fix, cosmetic
 * Bug B (accounts race condition) — hard fix, critical
 * Bug C (search cache) — looks easy, is architectural
 *
 * Multiple valid strategies:
 * - Fix B (best priority judgment)
 * - Fix A + attempt B (pragmatic)
 * - Fix A + recognize C is hard (shows good judgment)
 * 
 * The trap: spending all time on C (looks easy, wastes time)
 *
 * Anti-ceiling: 8 checks with partial scoring. Need 5+ to pass.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'triage-under-uncertainty',
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

// CHECK 1: TRIAGE.md exists
check('triage-document-exists', () => {
  const candidates = ['TRIAGE.md', 'triage.md', 'TRIAGE_NOTES.md', 'triage_notes.md',
    'ANALYSIS.md', 'analysis.md', 'NOTES.md', 'notes.md', 'FIX_NOTES.md', 'README.md'];
  
  let found = null;
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p) && name !== 'README.md') {
        const content = fs.readFileSync(p, 'utf8');
        // Must mention bugs or triage
        if (/bug|triage|priorit|101|102|103/i.test(content)) {
          found = { name, content };
          break;
        }
      }
    }
    if (found) break;
  }
  
  if (!found) {
    return { passed: false, detail: 'No triage document found' };
  }
  
  return {
    passed: found.content.length > 200,
    detail: `Found ${found.name} (${found.content.length} chars)`
  };
});

// CHECK 2: Triage doc mentions all three bugs
check('acknowledges-all-bugs', () => {
  let content = '';
  const candidates = ['TRIAGE.md', 'triage.md', 'TRIAGE_NOTES.md', 'ANALYSIS.md', 'NOTES.md', 'FIX_NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  const mentionsDates = /101|date|format|padding|zero.?pad/i.test(content);
  const mentionsAccounts = /102|balance|negative|race|concurrent|withdrawal/i.test(content);
  const mentionsSearch = /103|search|stale|cache/i.test(content);
  
  const count = [mentionsDates, mentionsAccounts, mentionsSearch].filter(Boolean).length;
  
  return {
    passed: count === 3,
    detail: `Mentions ${count}/3 bugs: dates=${mentionsDates}, accounts=${mentionsAccounts}, search=${mentionsSearch}`
  };
});

// CHECK 3: Prioritization reasoning exists
check('explains-priority-reasoning', () => {
  let content = '';
  const candidates = ['TRIAGE.md', 'triage.md', 'TRIAGE_NOTES.md', 'ANALYSIS.md', 'NOTES.md', 'FIX_NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  const priorityPatterns = [
    /priorit|urgent|critical|important|impact|severity/i,
    /first|before|higher|lower|order/i,
    /because|since|given|therefore|reason|rationale/i,
    /compliance|financial|money|risk/i,
    /easy|quick|simple|straightforward|cosmetic|low.?impact/i,
    /complex|difficult|architec|fundamental|design.?issue/i,
    /defer|later|skip|postpone|backlog/i
  ];
  
  const matches = priorityPatterns.filter(p => p.test(content));
  
  return {
    passed: matches.length >= 4,
    detail: `${matches.length}/7 reasoning patterns found (need ≥4)`
  };
});

// CHECK 4: Date bug fixed (Bug A — the easy one)
check('date-bug-fixed', () => {
  try {
    const output = execSync('node test/dates.test.js', {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 15000
    });
    const failMatch = output.match(/(\d+) failed/);
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    return { passed: f === 0, detail: f === 0 ? 'All date tests pass' : `${f} date tests still failing` };
  } catch (err) {
    const output = err.stdout || '';
    const failMatch = output.match(/(\d+) failed/);
    const f = failMatch ? parseInt(failMatch[1]) : '?';
    return { passed: false, detail: `Date tests failed (${f} failures)` };
  }
});

// CHECK 5: Account race condition addressed (Bug B — the critical one)
check('account-race-addressed', () => {
  const accountsPath = path.join(envDir, 'src', 'accounts.js');
  if (!fs.existsSync(accountsPath)) return { passed: false, detail: 'accounts.js not found' };
  
  const code = fs.readFileSync(accountsPath, 'utf8');
  
  // Strip comments to only look at actual code changes
  const codeNoComments = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Look for signs the race condition was addressed in actual code
  const fixPatterns = [
    /lock|mutex|semaphore/i,
    /atomic/i,
    /compareAnd|compare.and/i,
    /queue|serialize|serial/i,
    /synchronized/i,
    /while\s*\(.*pending/i,
    /retry|spin/i,
    /awaiting|processing/i
  ];
  
  const hasFixAttempt = fixPatterns.some(p => p.test(codeNoComments));
  
  // Also check if tests pass
  try {
    const output = execSync('node test/accounts.test.js', {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 15000
    });
    const failMatch = output.match(/(\d+) failed/);
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    
    return {
      passed: f === 0 || hasFixAttempt,
      detail: f === 0 ? 'All account tests pass (race condition fixed!)' : 
        hasFixAttempt ? `Race condition fix attempted (${f} tests still failing)` :
        `Account tests have ${f} failures, no fix attempted`
    };
  } catch (err) {
    return {
      passed: hasFixAttempt,
      detail: hasFixAttempt ? 'Race condition fix attempted but tests still failing' : 'No fix attempted'
    };
  }
});

// CHECK 6: Recognized Bug C is hard (didn't fall into the trap)
check('recognized-search-complexity', () => {
  let content = '';
  const candidates = ['TRIAGE.md', 'triage.md', 'TRIAGE_NOTES.md', 'ANALYSIS.md', 'NOTES.md', 'FIX_NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  const recognizedComplexity = [
    /architec|fundamental|design/i,
    /not.*simple|more.*complex|deceptive|deeper/i,
    /concurrent|race|ordering|event|async/i,
    /cache.*invalid|stale.*cache|cache.*stale/i,
    /defer|postpone|later|needs.*more|requires.*careful/i,
    /won'?t|can'?t|shouldn'?t.*quick.?fix/i
  ];
  
  const matches = recognizedComplexity.filter(p => p.test(content));
  
  return {
    passed: matches.length >= 2,
    detail: matches.length >= 2 
      ? `Agent recognized search bug complexity (${matches.length} indicators)`
      : `Insufficient recognition of search complexity (${matches.length} indicators)`
  };
});

// CHECK 7: Didn't make search worse (naive fix can break things)
check('search-not-made-worse', () => {
  try {
    const output = execSync('node test/search.test.js', {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 15000
    });
    const passMatch = output.match(/(\d+) passed/);
    const p = passMatch ? parseInt(passMatch[1]) : 0;
    // The basic tests (first 3) should still pass
    return { 
      passed: p >= 3, 
      detail: `${p} search tests pass (basic functionality intact)` 
    };
  } catch (err) {
    const output = err.stdout || '';
    const passMatch = output.match(/(\d+) passed/);
    const p = passMatch ? parseInt(passMatch[1]) : 0;
    return { 
      passed: p >= 3, 
      detail: `${p} search tests pass (basic functionality ${p >= 3 ? 'intact' : 'BROKEN'})` 
    };
  }
});

// CHECK 8: Bug B identified as highest priority
check('correct-priority-assessment', () => {
  let content = '';
  const candidates = ['TRIAGE.md', 'triage.md', 'TRIAGE_NOTES.md', 'ANALYSIS.md', 'NOTES.md', 'FIX_NOTES.md'];
  for (const name of candidates) {
    for (const dir of [envDir, path.join(envDir, '..')]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) content += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  
  // Bug B should be identified as highest priority (compliance, financial risk)
  const patterns = [
    /102.*(?:highest|top|first|critical|P0|urgent|most important)/i,
    /(?:highest|top|first|critical|P0|urgent|most important).*102/i,
    /balance.*(?:highest|critical|urgent|priority)/i,
    /(?:compliance|financial).*(?:first|priorit|critical)/i,
    /race.*(?:condition|concurrent).*(?:fix|address|resolve|priority)/i
  ];
  
  const matches = patterns.filter(p => p.test(content));
  
  // Also accept if they demonstrate it through action (fixed B)
  const accountsPath = path.join(envDir, 'src', 'accounts.js');
  const datesPath = path.join(envDir, 'src', 'dates.js');
  let accountsModified = false;
  if (fs.existsSync(accountsPath)) {
    const code = fs.readFileSync(accountsPath, 'utf8');
    const codeNoComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    accountsModified = /lock|mutex|atomic|queue|serialize|synchronized/i.test(codeNoComments);
  }
  
  return {
    passed: matches.length >= 1 || accountsModified,
    detail: matches.length >= 1 
      ? `Bug 102 identified as highest priority (${matches.length} patterns)`
      : accountsModified
        ? 'Bug 102 prioritized through action (race condition fix attempted)'
        : 'Bug 102 not clearly identified as highest priority'
  };
});

// SCORING
const totalPassed = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;

const triageExists = results.checks[0]?.passed ?? false;
const allAcknowledged = results.checks[1]?.passed ?? false;
const priorityReasoning = results.checks[2]?.passed ?? false;
const dateFixed = results.checks[3]?.passed ?? false;
const raceAddressed = results.checks[4]?.passed ?? false;
const searchRecognized = results.checks[5]?.passed ?? false;
const searchNotBroken = results.checks[6]?.passed ?? false;
const correctPriority = results.checks[7]?.passed ?? false;

// Core: must have triage document with reasoning
const coreJudgment = triageExists && allAcknowledged && priorityReasoning;

results.passed = coreJudgment && totalPassed >= 5;

if (totalPassed === 8) {
  results.summary = `EXCELLENT: Perfect triage — documented all bugs, correct priorities, fixed what matters (${totalPassed}/${totalChecks})`;
} else if (coreJudgment && raceAddressed && correctPriority) {
  results.summary = `GREAT: Strong judgment — identified and addressed the critical bug (${totalPassed}/${totalChecks})`;
} else if (coreJudgment && dateFixed) {
  results.summary = `GOOD: Fixed the easy bug and documented triage reasoning (${totalPassed}/${totalChecks})`;
} else if (coreJudgment) {
  results.summary = `ADEQUATE: Good analysis but limited fixes (${totalPassed}/${totalChecks})`;
} else if (!triageExists) {
  results.summary = `FAILED: No triage document — jumped straight to coding without explaining priorities (${totalPassed}/${totalChecks})`;
} else if (!allAcknowledged) {
  results.summary = `FAILED: Didn't assess all three bugs before starting (${totalPassed}/${totalChecks})`;
} else {
  results.summary = `PARTIAL: Some fixes but weak triage reasoning (${totalPassed}/${totalChecks})`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
