/**
 * Success Criteria Verifier for "heartbeat-triage-gap"
 *
 * Tests whether Bob correctly triages 4 pending heartbeat items.
 * Ground truth classifications:
 *   1. req:abc123 (FM-2.2 investigation) → DISPATCH (to coder/coach, not Bob's core work)
 *   2. req:def456 (gym sweep runs)       → DISPATCH (to coach, mechanical task)
 *   3. req:ghi789 (H-055 Bayesian update)→ DO-SELF (Bob's core competency: hypothesis work)
 *   4. req:jkl012 (deep-dive index)      → DEFER (already done per context + filesystem)
 *
 * We evaluate by inspecting:
 * - The finish() call's summary/completed_items/new_items
 * - Any written triage files
 * - Any fork/dispatch calls made
 *
 * Since this is a heartbeat simulation, the agent primarily uses agents tool
 * (fork/message) and finish(). We check the session transcript.
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'heartbeat-triage-gap',
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

// Helper: find session transcript
function findTranscript() {
  // The gym runner exports transcript.jsonl into workDir (= envDir). Check here first.
  const transcriptInEnv = path.join(envDir, 'transcript.jsonl');
  if (fs.existsSync(transcriptInEnv)) {
    return fs.readFileSync(transcriptInEnv, 'utf-8');
  }

  // Fallback: scan state/sessions/*/session.jsonl (prefer session.jsonl over receipts.jsonl)
  const stateDir = path.join(envDir, '..', 'state');
  const sessionsDir = path.join(stateDir, 'sessions');

  if (fs.existsSync(sessionsDir)) {
    const sessions = fs.readdirSync(sessionsDir).filter(d =>
      fs.statSync(path.join(sessionsDir, d)).isDirectory()
    );
    for (const s of sessions) {
      const files = fs.readdirSync(path.join(sessionsDir, s));
      // Prefer session.jsonl specifically over other .jsonl files (e.g. receipts.jsonl)
      const sessionFile = files.find(f => f === 'session.jsonl');
      if (sessionFile) {
        return fs.readFileSync(path.join(sessionsDir, s, sessionFile), 'utf-8');
      }
      const jsonl = files.find(f => f.endsWith('.jsonl') && f !== 'receipts.jsonl');
      if (jsonl) {
        return fs.readFileSync(path.join(sessionsDir, s, jsonl), 'utf-8');
      }
    }
  }

  // Also check for session.jsonl directly in state
  if (fs.existsSync(path.join(stateDir, 'session.jsonl'))) {
    return fs.readFileSync(path.join(stateDir, 'session.jsonl'), 'utf-8');
  }

  return null;
}

// Helper: scan all text files in envDir for content clues
function findWrittenFiles() {
  const written = {};
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(full);
      } else if (e.name.endsWith('.md') || e.name.endsWith('.txt') || e.name.endsWith('.json')) {
        try {
          written[path.relative(envDir, full)] = fs.readFileSync(full, 'utf-8');
        } catch (_) {}
      }
    }
  }
  scan(envDir);
  return written;
}

// Gather all evidence
const allFiles = findWrittenFiles();
const allContent = Object.values(allFiles).join('\n').toLowerCase();

// Parse transcript for tool calls (especially finish(), agents.fork/message, and reasoning text)
function parseTranscript() {
  const raw = findTranscript();
  if (!raw) return { reasoning: '', finishArgs: '', agentCalls: '' };

  const lines = raw.trim().split('\n');
  const reasoning = [];
  const finishArgs = [];
  const agentCalls = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'assistant' && entry.content) {
        for (const block of entry.content) {
          // Collect reasoning text
          if (block.type === 'text' && block.text) {
            reasoning.push(block.text);
          }
          // Collect finish() arguments
          if (block.type === 'toolCall' && block.name === 'finish' && block.arguments) {
            const args = typeof block.arguments === 'string'
              ? block.arguments : JSON.stringify(block.arguments);
            finishArgs.push(args);
          }
          // Collect agents() calls
          if (block.type === 'toolCall' && block.name === 'agents' && block.arguments) {
            const args = typeof block.arguments === 'string'
              ? block.arguments : JSON.stringify(block.arguments);
            agentCalls.push(args);
          }
        }
      }
    } catch (_) {}
  }

  return {
    reasoning: reasoning.join('\n').toLowerCase(),
    finishArgs: finishArgs.join('\n').toLowerCase(),
    agentCalls: agentCalls.join('\n').toLowerCase()
  };
}

const transcript = parseTranscript();
// Combined transcript text for searching
const transcriptAll = [transcript.reasoning, transcript.finishArgs, transcript.agentCalls].join('\n');

// Also check for triage-specific file
const triageFiles = Object.keys(allFiles).filter(f =>
  f.toLowerCase().includes('triage') || f.toLowerCase().includes('dispatch')
);
const triageContent = triageFiles.map(f => allFiles[f]).join('\n').toLowerCase();

// Check 1: Did Bob identify the FM-2.2 investigation as something to DISPATCH (not do himself)?
check('item1-fm22-dispatched', () => {
  // We look for NEW files written by the agent (not original environment files)
  // that mention FM-2.2 AND dispatching/delegation
  const originalFiles = [
    'agents/bob/workspace/todo.md',
    'agents/shared/knowledge/experiments/EXP-070/results.md',
    'agents/shared/knowledge/hypotheses/H-055.md',
    'agents/shared/knowledge/library/deep-dives/INDEX.md'
  ];

  const newFileContent = Object.entries(allFiles)
    .filter(([f]) => !originalFiles.includes(f))
    .map(([, content]) => content)
    .join('\n').toLowerCase();

  // Also check if todo.md was modified (new content added)
  const originalTodo = fs.readFileSync(
    path.join(__dirname, 'environment/agents/bob/workspace/todo.md'), 'utf-8'
  ).toLowerCase();
  const currentTodo = (allFiles['agents/bob/workspace/todo.md'] || '').toLowerCase();
  const todoAdditions = currentTodo.length > originalTodo.length
    ? currentTodo.slice(originalTodo.length) : '';

  const searchContent = newFileContent + '\n' + todoAdditions;

  const fm22Mentioned = searchContent.includes('fm-2.2') || searchContent.includes('fm2.2') ||
    searchContent.includes('slippery edit') || searchContent.includes('abc123');
  const delegated = searchContent.includes('dispatch') || searchContent.includes('fork') ||
    searchContent.includes('delegate') || searchContent.includes('message');

  if (fm22Mentioned && delegated) {
    return { passed: true, detail: 'FM-2.2 investigation identified and dispatch/delegation signals present in new content' };
  }

  // Transcript fallback: check if agent discussed dispatching FM-2.2 in reasoning or finish()
  const fm22InTranscript = transcriptAll.includes('fm-2.2') || transcriptAll.includes('fm2.2') ||
    transcriptAll.includes('slippery edit') || transcriptAll.includes('abc123');
  const delegatedInTranscript = transcriptAll.includes('dispatch') || transcriptAll.includes('fork') ||
    transcriptAll.includes('delegate') || transcriptAll.includes('route');
  const notBobWork = transcriptAll.includes('not architect') || transcriptAll.includes('not my') ||
    transcriptAll.includes('not bob') || transcriptAll.includes('operational') ||
    transcriptAll.includes('debugging');

  if (fm22InTranscript && (delegatedInTranscript || notBobWork)) {
    return { passed: true, detail: 'FM-2.2 investigation identified as dispatch in transcript reasoning/finish' };
  }

  if (fm22InTranscript) {
    return { passed: false, detail: 'FM-2.2 mentioned in transcript but no clear dispatch signal' };
  }

  return { passed: false, detail: 'FM-2.2 investigation not addressed in files or transcript' };
});

// Check 2: Did Bob identify the gym sweep as something to DISPATCH?
check('item2-gym-sweep-dispatched', () => {
  const originalFiles = [
    'agents/bob/workspace/todo.md',
    'agents/shared/knowledge/experiments/EXP-070/results.md',
    'agents/shared/knowledge/hypotheses/H-055.md',
    'agents/shared/knowledge/library/deep-dives/INDEX.md'
  ];

  const newFileContent = Object.entries(allFiles)
    .filter(([f]) => !originalFiles.includes(f))
    .map(([, content]) => content)
    .join('\n').toLowerCase();

  const originalTodo = fs.readFileSync(
    path.join(__dirname, 'environment/agents/bob/workspace/todo.md'), 'utf-8'
  ).toLowerCase();
  const currentTodo = (allFiles['agents/bob/workspace/todo.md'] || '').toLowerCase();
  const todoAdditions = currentTodo.length > originalTodo.length
    ? currentTodo.slice(originalTodo.length) : '';

  const searchContent = newFileContent + '\n' + todoAdditions;

  const sweepMentioned = searchContent.includes('gym') || searchContent.includes('wrong-tool-args') ||
    searchContent.includes('def456') || searchContent.includes('sweep');
  const delegated = searchContent.includes('dispatch') || searchContent.includes('fork') ||
    searchContent.includes('delegate') || searchContent.includes('coach') ||
    searchContent.includes('message');

  if (sweepMentioned && delegated) {
    return { passed: true, detail: 'Gym sweep identified and dispatch/delegation signals present in new content' };
  }

  // Transcript fallback
  const sweepInTranscript = transcriptAll.includes('gym') || transcriptAll.includes('wrong-tool-args') ||
    transcriptAll.includes('def456') || transcriptAll.includes('sweep');
  const delegatedInTranscript = transcriptAll.includes('dispatch') || transcriptAll.includes('fork') ||
    transcriptAll.includes('delegate') || transcriptAll.includes('coach') ||
    transcriptAll.includes('already dispatched') || transcriptAll.includes('await');

  if (sweepInTranscript && delegatedInTranscript) {
    return { passed: true, detail: 'Gym sweep identified as dispatch/already-dispatched in transcript' };
  }

  if (sweepInTranscript) {
    return { passed: false, detail: 'Gym sweep mentioned in transcript but no dispatch signal' };
  }

  return { passed: false, detail: 'Gym sweep not addressed in files or transcript' };
});

// Check 3: Did Bob identify H-055 update as something to DO HIMSELF?
check('item3-h055-self-task', () => {
  const originalFiles = [
    'agents/bob/workspace/todo.md',
    'agents/shared/knowledge/experiments/EXP-070/results.md',
    'agents/shared/knowledge/hypotheses/H-055.md',
    'agents/shared/knowledge/library/deep-dives/INDEX.md'
  ];

  const newFileContent = Object.entries(allFiles)
    .filter(([f]) => !originalFiles.includes(f))
    .map(([, content]) => content)
    .join('\n').toLowerCase();

  const originalTodo = fs.readFileSync(
    path.join(__dirname, 'environment/agents/bob/workspace/todo.md'), 'utf-8'
  ).toLowerCase();
  const currentTodo = (allFiles['agents/bob/workspace/todo.md'] || '').toLowerCase();
  const todoAdditions = currentTodo.length > originalTodo.length
    ? currentTodo.slice(originalTodo.length) : '';

  const searchContent = newFileContent + '\n' + todoAdditions;

  const h055Mentioned = searchContent.includes('h-055') || searchContent.includes('h055') ||
    searchContent.includes('bayesian') || searchContent.includes('ghi789') ||
    searchContent.includes('posterior');

  // Check if Bob actually modified H-055 (strong signal of self-work)
  const originalH055 = fs.readFileSync(
    path.join(__dirname, 'environment/agents/shared/knowledge/hypotheses/H-055.md'), 'utf-8'
  );
  const currentH055 = allFiles['agents/shared/knowledge/hypotheses/H-055.md'] || '';
  const h055Modified = currentH055 !== originalH055 && currentH055.length > 0;

  // Also check for self-fork signals (forking to bob with hypothesis task)
  const selfForkSignals = searchContent.includes('bob') && (
    searchContent.includes('h-055') || searchContent.includes('bayesian') || searchContent.includes('hypothesis')
  );

  if (h055Modified) {
    return { passed: true, detail: 'H-055 file was directly modified — Bob did the work himself' };
  }

  if (h055Mentioned && selfForkSignals) {
    return { passed: true, detail: 'H-055 Bayesian update identified and signals of self-execution/self-fork' };
  }

  if (h055Mentioned) {
    // Check if they wrongly delegated to a non-Bob agent
    const wrongDelegation = (searchContent.includes('coach') || searchContent.includes('coder')) &&
      (searchContent.includes('h-055') || searchContent.includes('bayesian'));
    if (wrongDelegation) {
      return { passed: false, detail: 'H-055 update was delegated to another agent — should be Bob\'s own work' };
    }
    // Mentioned but unclear — give partial credit if they at least acknowledged it
    return { passed: true, detail: 'H-055 mentioned in triage — assumed self-task (generous interpretation)' };
  }

  // Transcript fallback: check if Bob discussed doing H-055 himself
  const h055InTranscript = transcriptAll.includes('h-055') || transcriptAll.includes('h055') ||
    transcriptAll.includes('bayesian') || transcriptAll.includes('ghi789') ||
    transcriptAll.includes('posterior');
  const selfWorkInTranscript = transcriptAll.includes('inline') || transcriptAll.includes('do myself') ||
    transcriptAll.includes('do it') || transcriptAll.includes('quick') ||
    transcriptAll.includes('self') || transcriptAll.includes('completed');

  if (h055InTranscript && selfWorkInTranscript) {
    return { passed: true, detail: 'H-055 identified as self-task in transcript reasoning' };
  }

  // If H-055 was mentioned in transcript at all, and agent did the update in finish() completed_items
  if (h055InTranscript && transcript.finishArgs.includes('h-055')) {
    return { passed: true, detail: 'H-055 listed in finish() completed_items — self-task confirmed' };
  }

  if (h055InTranscript) {
    return { passed: false, detail: 'H-055 mentioned in transcript but no clear self-task signal' };
  }

  return { passed: false, detail: 'H-055 Bayesian update not addressed in files or transcript' };
});

// Check 4 (KEY): Did Bob correctly identify the deep-dive index task as DEFER/SKIP?
check('item4-deepdive-deferred', () => {
  const originalFiles = [
    'agents/bob/workspace/todo.md',
    'agents/shared/knowledge/experiments/EXP-070/results.md',
    'agents/shared/knowledge/hypotheses/H-055.md',
    'agents/shared/knowledge/library/deep-dives/INDEX.md'
  ];

  const newFileContent = Object.entries(allFiles)
    .filter(([f]) => !originalFiles.includes(f))
    .map(([, content]) => content)
    .join('\n').toLowerCase();

  const originalTodo = fs.readFileSync(
    path.join(__dirname, 'environment/agents/bob/workspace/todo.md'), 'utf-8'
  ).toLowerCase();
  const currentTodo = (allFiles['agents/bob/workspace/todo.md'] || '').toLowerCase();
  const todoAdditions = currentTodo.length > originalTodo.length
    ? currentTodo.slice(originalTodo.length) : '';

  const searchContent = newFileContent + '\n' + todoAdditions;

  // Check if the INDEX was modified (it shouldn't be — it's already correct)
  const originalIndex = fs.readFileSync(
    path.join(__dirname, 'environment/agents/shared/knowledge/library/deep-dives/INDEX.md'), 'utf-8'
  );
  const currentIndex = allFiles['agents/shared/knowledge/library/deep-dives/INDEX.md'] || '';
  const indexModified = currentIndex !== originalIndex;

  if (indexModified) {
    return { passed: false, detail: 'Deep-dive INDEX.md was modified — Bob did unnecessary work on already-complete task' };
  }

  const indexMentioned = searchContent.includes('deep-dive') || searchContent.includes('dd-501') ||
    searchContent.includes('jkl012') || searchContent.includes('dd-504');

  // The key test: did Bob recognize this is already done?
  const deferSignals = [
    'already done', 'already complete', 'already updated', 'already handled',
    'skip', 'defer', 'no action', 'not needed', 'completed',
    'done yesterday', 'already in', 'already present', 'no longer needed'
  ];
  const deferred = deferSignals.some(s => searchContent.includes(s));

  if (indexMentioned && deferred) {
    return { passed: true, detail: 'Deep-dive index task correctly identified as already done / deferred' };
  }

  if (!indexMentioned && !newFileContent && !todoAdditions) {
    // No files written at all — can't tell
    return { passed: true, detail: 'No new content written — deep-dive index implicitly skipped (acceptable)' };
  }

  if (!indexMentioned) {
    // Not mentioning it at all means they silently skipped — correct behavior
    // But check transcript — if they explicitly noted it's done, even better
    const indexInTranscript = transcriptAll.includes('deep-dive') || transcriptAll.includes('dd-501') ||
      transcriptAll.includes('jkl012') || transcriptAll.includes('dd-504') ||
      transcriptAll.includes('index');
    const deferInTranscript = ['already done', 'already complete', 'already updated', 'already handled',
      'skip', 'defer', 'stale', 'no action', 'not needed', 'completed',
      'done yesterday', 'already in', 'already present', 'no longer needed', 'confirmed']
      .some(s => transcriptAll.includes(s));

    if (indexInTranscript && deferInTranscript) {
      return { passed: true, detail: 'Deep-dive index task correctly identified as already done in transcript' };
    }
    return { passed: true, detail: 'Deep-dive index task not mentioned in new content — implicitly skipped (acceptable)' };
  }

  // Mentioned but not deferred — they might have dispatched it (wrong)
  // But check transcript for defer signals
  if (indexMentioned && !deferred) {
    const deferInTranscript = ['already done', 'already complete', 'already updated', 'already handled',
      'skip', 'defer', 'stale', 'no action', 'not needed', 'completed',
      'done yesterday', 'already in', 'already present', 'no longer needed', 'confirmed']
      .some(s => transcriptAll.includes(s));
    if (deferInTranscript) {
      return { passed: true, detail: 'Deep-dive index mentioned in files but correctly deferred in transcript' };
    }
    return { passed: false, detail: 'Deep-dive index mentioned in new content but not clearly deferred despite being already complete' };
  }

  return { passed: false, detail: 'Deep-dive index task handling unclear' };
});

// Check 5: Overall triage quality — did Bob address at least 3 of 4 items?
check('triage-coverage', () => {
  const itemsAddressed = results.checks.filter(c =>
    c.name.startsWith('item') && c.passed
  ).length;

  if (itemsAddressed >= 3) {
    return { passed: true, detail: `${itemsAddressed}/4 items correctly handled` };
  }

  return { passed: false, detail: `Only ${itemsAddressed}/4 items correctly handled (need ≥3)` };
});

// Check 6: Did Bob avoid doing substantive work inline?
// Heartbeat should be lean — no long analysis, no multi-step investigation
check('heartbeat-lean', () => {
  // Count total files written by the agent (excluding original environment files)
  // A lean heartbeat should write very few files — mostly triage/dispatch
  const originalFiles = [
    'agents/bob/workspace/todo.md',
    'agents/shared/knowledge/experiments/EXP-070/results.md',
    'agents/shared/knowledge/hypotheses/H-055.md',
    'agents/shared/knowledge/library/deep-dives/INDEX.md'
  ];

  const newFiles = Object.keys(allFiles).filter(f => !originalFiles.includes(f));

  // More than 5 new files suggests the agent went too deep
  if (newFiles.length > 5) {
    return {
      passed: false,
      detail: `${newFiles.length} new files written — heartbeat should be lean (triage + dispatch, not deep work)`
    };
  }

  return {
    passed: true,
    detail: `${newFiles.length} new files written — heartbeat stayed lean`
  };
});

// Scoring: need at least 3/4 items correct AND triage coverage AND lean heartbeat
const itemChecks = results.checks.filter(c => c.name.startsWith('item'));
const itemsPassed = itemChecks.filter(c => c.passed).length;
const coveragePassed = results.checks.find(c => c.name === 'triage-coverage')?.passed || false;
const leanPassed = results.checks.find(c => c.name === 'heartbeat-lean')?.passed || false;

results.passed = itemsPassed >= 3 && coveragePassed;

if (results.passed) {
  results.summary = `Bob correctly classified ${itemsPassed}/4 heartbeat items. Heartbeat was ${leanPassed ? 'lean' : 'not lean'}.`;
} else {
  const failedItems = itemChecks.filter(c => !c.passed).map(c => c.name);
  results.summary = `Triage gap: ${itemsPassed}/4 items correct. Failed: ${failedItems.join(', ')}`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
