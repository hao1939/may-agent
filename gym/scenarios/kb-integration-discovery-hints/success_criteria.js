/**
 * Success Criteria for "kb-integration-discovery"
 *
 * Tests whether the agent completed ALL 7 knowledge base file updates
 * from the EXP-142 experiment results in a discovery setting (files not
 * explicitly listed). The agent must explore the KB to find what needs updating.
 *
 * 8 checks: 7 individual file updates + 1 aggregate "all files modified"
 * Check names match EXP-117 baseline for comparison.
 *
 * Usage: node success_criteria.js <workDir>
 */

const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || __dirname;

const results = {
  scenario: 'kb-integration-discovery',
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
check('h042-probability', () => {
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
check('ke017-evidence', () => {
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
check('ke023-status', () => {
  const entriesDir = path.join(workDir, 'knowledge', 'entries');
  const files = fs.readdirSync(entriesDir).filter(f => f.startsWith('KE-023'));
  if (files.length === 0) {
    return { passed: false, detail: 'No KE-023* file found in entries/' };
  }
  for (const file of files) {
    const content = fs.readFileSync(path.join(entriesDir, file), 'utf-8');
    const hasValidated = /VALIDATED/i.test(content);
    const hasTestingStatus = /\*\*Status\*\*:\s*TESTING/i.test(content);
    if (hasValidated && !hasTestingStatus) {
      return {
        passed: true,
        detail: `${file} updated to VALIDATED`
      };
    }
  }
  return {
    passed: false,
    detail: `KE-023 file(s) found (${files.join(', ')}) but status still TESTING`
  };
});

// Check 4: INDEX.md — New KE-071 row added referencing EXP-142
check('index-entry-added', () => {
  const filePath = path.join(workDir, 'knowledge', 'INDEX.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'INDEX.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasKE071 = /KE-071/.test(content);
  const hasEXP142Ref = /EXP-142/.test(content);
  const passed = hasKE071 && hasEXP142Ref;
  return {
    passed,
    detail: passed
      ? 'INDEX.md has new KE-071 entry referencing EXP-142'
      : `INDEX.md issues: hasKE071=${hasKE071}, hasEXP142Ref=${hasEXP142Ref}`
  };
});

// Check 5: PRIORITY-TRACKER.md — H-042 moved to High Priority
check('priority-reordered', () => {
  const filePath = path.join(workDir, 'knowledge', 'PRIORITY-TRACKER.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'PRIORITY-TRACKER.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
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

// Check 6: SYNTH-008.md — Updated with EXP-142 findings (hidden target)
// The unmodified file mentions "EXP-142 pending" — we need to check that the
// assessment was actually updated with results, not just the pending reference.
check('synth008-updated', () => {
  const filePath = path.join(workDir, 'knowledge', 'syntheses', 'SYNTH-008.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'SYNTH-008.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  // Must mention EXP-142 results/findings (not just "EXP-142 pending")
  const hasEXP142Results = /EXP-142.{0,40}(?:result|finding|show|confirm|demonstrat|prov)/i.test(content)
    || /(?:result|finding).{0,40}EXP-142/i.test(content);
  // Must have updated quantitative data or status from the experiment
  const hasQuantitativeUpdate = /62%/.test(content) || /0\.72/.test(content)
    || /1[,.]?000\s*(?:request|sample)/i.test(content)
    || /latency.*reduc/i.test(content);
  // Alternatively: the "Gaps" section should be updated (EXP-142 no longer pending)
  const gapUpdated = !/No large-scale validation \(EXP-142 pending\)/.test(content)
    || /EXP-142.*complet/i.test(content);
  const passed = (hasEXP142Results && hasQuantitativeUpdate) || (hasEXP142Results && gapUpdated);
  return {
    passed,
    detail: passed
      ? 'SYNTH-008.md updated with EXP-142 findings'
      : `SYNTH-008.md issues: hasEXP142Results=${hasEXP142Results}, hasQuantitativeUpdate=${hasQuantitativeUpdate}, gapUpdated=${gapUpdated}`
  };
});

// Check 7: todo.md — EXP-142 item marked complete
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

// Check 8: ALL files modified (aggregate)
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

// Overall pass: all checks pass
results.passed = results.checks.every(c => c.passed);
results.summary = results.passed
  ? 'All checks passed — all 7 KB files correctly updated with EXP-142 findings'
  : `${results.checks.filter(c => c.passed).length}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
