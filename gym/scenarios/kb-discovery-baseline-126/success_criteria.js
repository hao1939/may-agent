/**
 * Success Criteria for "kb-integration-discovery"
 *
 * Tests whether the agent DISCOVERED and COMPLETED ALL 7 knowledge base file updates
 * from the EXP-142 experiment results. Unlike kb-integration-multi-file, the task
 * does NOT list the specific files — the agent must explore the knowledge/ directory,
 * read the experiment results, and figure out what needs updating.
 *
 * The trap: 15+ files in the environment. Agents with FM-2.6 (read-loop + incomplete
 * delivery) will spend too much time reading context files (design docs, meeting notes,
 * reviews, distractor entries) and fail to complete all 6 required updates.
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

// Check 2: KE-017.md — New evidence section with EXP-142 results (62% reduction)
check('ke017-evidence-appended', () => {
  const filePath = path.join(workDir, 'knowledge', 'entries', 'KE-017.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'KE-017.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  // Must have the actual EXP-142 result — the 62% latency reduction figure
  const has62 = /62%/.test(content);
  // Must have more content than the original (~25 lines / 778 bytes)
  const isExpanded = content.length > 900;
  const passed = has62 && isExpanded;
  return {
    passed,
    detail: passed
      ? 'KE-017.md has EXP-142 evidence with 62% latency reduction finding'
      : `KE-017.md issues: has62pct=${has62}, isExpanded=${isExpanded} (len=${content.length})`
  };
});

// Check 3: KE-023 (any filename variant) — Status changed from TESTING to VALIDATED
check('ke023-status-validated', () => {
  const entriesDir = path.join(workDir, 'knowledge', 'entries');
  const files = fs.readdirSync(entriesDir).filter(f => f.startsWith('KE-023'));
  if (files.length === 0) {
    return { passed: false, detail: 'No KE-023* file found in entries/' };
  }
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

// Check 6: SYNTH-008 — Synthesis document updated with EXP-142 results
check('synth008-updated', () => {
  const filePath = path.join(workDir, 'knowledge', 'synthesis', 'SYNTH-008-cache-performance.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'SYNTH-008-cache-performance.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  // Must have EXP-142 row in table changed from "Pending"/"TBD" to Complete/Validated
  // Check that the EXP-142 table row specifically has a completion status
  const lines = content.split('\n');
  const exp142Row = lines.find(l => l.includes('EXP-142') && l.includes('|'));
  const rowHasComplete = exp142Row && (/Complete/i.test(exp142Row) || /Validated/i.test(exp142Row));
  const rowStillPending = exp142Row && (/Pending/i.test(exp142Row) || /TBD/i.test(exp142Row));
  // Must have the "awaiting EXP-142" removed from header status
  const headerStillAwaiting = /awaiting.*EXP-142/i.test(content);
  // Must have actual results data (62% figure)
  const hasResults = /62%/.test(content);
  const passed = rowHasComplete && !rowStillPending && !headerStillAwaiting && hasResults;
  return {
    passed,
    detail: passed
      ? 'SYNTH-008 updated with EXP-142 completion and results'
      : `SYNTH-008 issues: rowHasComplete=${!!rowHasComplete}, rowStillPending=${!!rowStillPending}, headerStillAwaiting=${headerStillAwaiting}, hasResults=${hasResults}`
  };
});

// Check 7: todo.md — EXP-142 integration item marked complete
check('todo-marked-complete', () => {
  const filePath = path.join(workDir, 'todo.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'todo.md does not exist' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  // The specific todo "Integrate EXP-142 results into knowledge base" must be checked off
  const integrateDone = /- \[x\].*[Ii]ntegrate.*EXP-142/i.test(content);
  const integrateStillOpen = /- \[ \].*[Ii]ntegrate.*EXP-142/i.test(content);
  const passed = integrateDone && !integrateStillOpen;
  return {
    passed,
    detail: passed
      ? 'EXP-142 integration todo item marked as complete'
      : `todo.md: integrateDone=${integrateDone}, integrateStillOpen=${integrateStillOpen}`
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

results.passed = results.checks.every(c => c.passed);
results.summary = results.passed
  ? 'All checks passed — all 7 KB files correctly updated with EXP-142 findings'
  : `${results.checks.filter(c => c.passed).length}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
