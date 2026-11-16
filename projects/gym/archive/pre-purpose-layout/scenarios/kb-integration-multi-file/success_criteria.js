/**
 * Success Criteria for "kb-integration-multi-file"
 *
 * Tests whether the agent completed ALL 6 knowledge base file updates
 * from the EXP-142 experiment results. This scenario targets Bob's FM-2.6
 * pattern: he plans correctly but loses track of completion across N files.
 *
 * The trap: 6 files to update. Agents with poor completion tracking will
 * update 2-3 files then drift to reading, reasoning, or premature finish().
 * One file (KE-023) has a slightly different filename than stated in the task
 * to test ENOENT recovery.
 *
 * Usage: node success_criteria.js <workDir>
 */

const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || __dirname;

const results = {
  scenario: 'kb-integration-multi-file',
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

// Check 1: H-042.md — P(H) updated from 0.35 to 0.72
check('h042-probability-updated', () => {
  const filePath = path.join(workDir, 'knowledge', 'hypotheses', 'H-042.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'H-042.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasNewProb = /0\.72/.test(content);
  const hasOldProb = /\*\*P\(H\)\*\*:\s*0\.35/.test(content);
  const hasEvidence = /EXP-142/i.test(content) && /evidence/i.test(content);
  const passed = hasNewProb && !hasOldProb && hasEvidence;
  return {
    passed,
    detail: passed
      ? 'H-042.md updated: P(H)=0.72, has EXP-142 evidence section'
      : `H-042.md issues: hasNewProb=${hasNewProb}, oldProbRemoved=${!hasOldProb}, hasEvidence=${hasEvidence}`
  };
});

// Check 2: KE-017.md — New evidence section appended
check('ke017-evidence-appended', () => {
  const filePath = path.join(workDir, 'knowledge', 'entries', 'KE-017.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'KE-017.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasEXP142 = /EXP-142/i.test(content);
  const hasLatencyFinding = /62%/i.test(content) || /latency/i.test(content);
  const passed = hasEXP142 && hasLatencyFinding;
  return {
    passed,
    detail: passed
      ? 'KE-017.md has EXP-142 evidence with latency finding'
      : `KE-017.md issues: hasEXP142=${hasEXP142}, hasLatencyFinding=${hasLatencyFinding}`
  };
});

// Check 3: KE-023 (any filename variant) — Status changed from TESTING to VALIDATED
check('ke023-status-validated', () => {
  const entriesDir = path.join(workDir, 'knowledge', 'entries');
  // The file might be KE-023.md or KE-023-cache-architecture.md or any variant
  const files = fs.readdirSync(entriesDir).filter(f => f.startsWith('KE-023'));
  if (files.length === 0) {
    return { passed: false, detail: 'No KE-023* file found in entries/' };
  }
  // Check any KE-023 file for VALIDATED status
  for (const file of files) {
    const content = fs.readFileSync(path.join(entriesDir, file), 'utf-8');
    const hasValidated = /VALIDATED/i.test(content);
    const hasTestingStatus = /\*\*Status\*\*:\s*TESTING/i.test(content);
    const hasDate = /2026-04-09/.test(content);
    if (hasValidated && !hasTestingStatus) {
      return {
        passed: hasDate,
        detail: hasDate
          ? `${file} updated to VALIDATED with date 2026-04-09`
          : `${file} updated to VALIDATED but missing validation date 2026-04-09`
      };
    }
  }
  return {
    passed: false,
    detail: `KE-023 file(s) found (${files.join(', ')}) but status still TESTING`
  };
});

// Check 4: INDEX.md — New KE-071 row added
check('index-entry-added', () => {
  const filePath = path.join(workDir, 'knowledge', 'INDEX.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'INDEX.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasKE071 = /KE-071/.test(content);
  const hasEXP142 = /EXP-142/.test(content);
  const passed = hasKE071 && hasEXP142;
  return {
    passed,
    detail: passed
      ? 'INDEX.md has new KE-071 entry referencing EXP-142'
      : `INDEX.md issues: hasKE071=${hasKE071}, hasEXP142=${hasEXP142}`
  };
});

// Check 5: PRIORITY-TRACKER.md — H-042 moved to High Priority
check('priority-reordered', () => {
  const filePath = path.join(workDir, 'knowledge', 'PRIORITY-TRACKER.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'PRIORITY-TRACKER.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');

  // H-042 should be under High Priority, not under Medium Priority
  const highSection = content.split(/## Medium Priority/i)[0] || '';
  const mediumSection = (content.split(/## Medium Priority/i)[1] || '').split(/## Low Priority/i)[0] || '';

  const inHigh = /H-042/.test(highSection) && /High Priority/i.test(highSection);
  const inMedium = /H-042/.test(mediumSection);

  const passed = inHigh && !inMedium;
  return {
    passed,
    detail: passed
      ? 'H-042 moved to High Priority section'
      : `H-042 placement: inHigh=${inHigh}, stillInMedium=${inMedium}`
  };
});

// Check 6: todo.md — EXP-142 item marked complete
check('todo-marked-complete', () => {
  const filePath = path.join(workDir, 'todo.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'todo.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const markedDone = /- \[x\].*(?:EXP-142|integrate results)/i.test(content);
  const stillUndone = /- \[ \].*(?:EXP-142|integrate results)/i.test(content);
  const passed = markedDone && !stillUndone;
  return {
    passed,
    detail: passed
      ? 'EXP-142 todo item marked as complete'
      : `todo.md: markedDone=${markedDone}, stillUndone=${stillUndone}`
  };
});

// Check 7: ALL files modified (aggregate — did the agent touch all 6?)
check('all-files-modified', () => {
  const checks = results.checks.filter(c => c.name !== 'all-files-modified');
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  const passed = passedCount === totalCount;
  return {
    passed,
    detail: passed
      ? `All ${totalCount} files correctly updated`
      : `Only ${passedCount}/${totalCount} files correctly updated: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
  };
});

// Overall pass: at least 6 of 7 checks pass (the aggregate check passes only if all 6 individual pass)
results.passed = results.checks.every(c => c.passed);
results.summary = results.passed
  ? 'All checks passed — all 6 KB files correctly updated with EXP-142 findings'
  : `${results.checks.filter(c => c.passed).length}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
