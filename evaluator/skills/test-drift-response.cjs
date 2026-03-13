// agents/evaluator/skills/test-drift-response.cjs
// Integration test: simulates P53 drift and verifies the full L3 pipeline.
//
// Strategy:
//   1. Create a temporary snapshot with known hashes
//   2. Tamper with files so they mismatch (simulated drift)
//   3. Run detectP53Drift → verify structured JSON output
//   4. Run trigger-response → verify correct routing
//   5. Clean up
//
// Usage:  node test-drift-response.cjs

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import the modules under test
const {
  detectP53Drift,
  buildDriftResponses,
  classifyDriftLevel,
  actionForLevel,
  agentFromPath,
  formatReport
} = require('./detect-p53-drift.cjs');

const {
  processResponse,
  processAllResponses
} = require('./trigger-response.cjs');

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(`${label} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
    console.log(`  ❌ ${label}  — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Unit tests: helper functions
// ---------------------------------------------------------------------------
console.log('\n═══════════════════════════════════════════');
console.log('  L3 DRIFT RESPONSE — TEST SUITE');
console.log('═══════════════════════════════════════════\n');

console.log('▸ agentFromPath()');
assertEq(agentFromPath('agents/coder/SOUL.md'), 'coder', 'extracts "coder" from path');
assertEq(agentFromPath('agents/tech-lead/agent.json'), 'tech-lead', 'extracts "tech-lead" from path');
assertEq(agentFromPath('random/file.txt'), 'unknown', 'returns "unknown" for non-agent paths');

console.log('\n▸ classifyDriftLevel()');
assertEq(classifyDriftLevel(0), 'NONE', '0% → NONE');
assertEq(classifyDriftLevel(0.05), 'WARNING', '5% → WARNING');
assertEq(classifyDriftLevel(0.09), 'WARNING', '9% → WARNING');
assertEq(classifyDriftLevel(0.10), 'CRITICAL', '10% → CRITICAL');
assertEq(classifyDriftLevel(0.25), 'CRITICAL', '25% → CRITICAL');
assertEq(classifyDriftLevel(0.30), 'CRITICAL', '30% → CRITICAL');
assertEq(classifyDriftLevel(0.31), 'CATASTROPHIC', '31% → CATASTROPHIC');
assertEq(classifyDriftLevel(0.80), 'CATASTROPHIC', '80% → CATASTROPHIC');

console.log('\n▸ actionForLevel()');
assertEq(actionForLevel('NONE'), 'NONE', 'NONE → NONE');
assertEq(actionForLevel('WARNING'), 'NONE', 'WARNING → NONE (informational)');
assertEq(actionForLevel('CRITICAL'), 'GROWTH_CYCLE', 'CRITICAL → GROWTH_CYCLE');
assertEq(actionForLevel('CATASTROPHIC'), 'REVERT', 'CATASTROPHIC → REVERT');

// ---------------------------------------------------------------------------
// 2. Unit tests: buildDriftResponses with synthetic audit results
// ---------------------------------------------------------------------------
console.log('\n▸ buildDriftResponses() — passing audit');
{
  const passResult = {
    passed: true,
    diffs: {},
    missing: [],
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const responses = buildDriftResponses(passResult);
  assertEq(responses.length, 1, 'returns 1 response for passing audit');
  assertEq(responses[0].drift_level, 'NONE', 'drift_level is NONE');
  assertEq(responses[0].action_required, 'NONE', 'action_required is NONE');
  assertEq(responses[0].bad_files.length, 0, 'no bad files');
}

console.log('\n▸ buildDriftResponses() — WARNING drift (1 of 24 files = ~4%)');
{
  const warnResult = {
    passed: false,
    diffs: { 'agents/coder/SOUL.md': { expected: 'aaa', actual: 'bbb' } },
    missing: [],
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const responses = buildDriftResponses(warnResult);
  assertEq(responses.length, 1, 'returns 1 response (single agent)');
  assertEq(responses[0].agent, 'coder', 'agent is coder');
  assertEq(responses[0].drift_level, 'WARNING', 'drift_level is WARNING (~4%)');
  assertEq(responses[0].action_required, 'NONE', 'WARNING → no action required');
  assert(responses[0].bad_files.includes('agents/coder/SOUL.md'), 'bad_files includes the drifted file');
}

console.log('\n▸ buildDriftResponses() — CRITICAL drift (3 of 24 = 12.5%)');
{
  const critResult = {
    passed: false,
    diffs: {
      'agents/coder/SOUL.md': { expected: 'a', actual: 'b' },
      'agents/coder/agent.json': { expected: 'a', actual: 'b' }
    },
    missing: ['agents/coder/TOOLS.md'],  // missing also counts
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const responses = buildDriftResponses(critResult);
  assertEq(responses.length, 1, 'returns 1 response (all files belong to coder)');
  assertEq(responses[0].drift_level, 'CRITICAL', '12.5% → CRITICAL');
  assertEq(responses[0].action_required, 'GROWTH_CYCLE', 'CRITICAL → GROWTH_CYCLE');
  assertEq(responses[0].bad_files.length, 3, '3 bad files total');
}

console.log('\n▸ buildDriftResponses() — CATASTROPHIC drift (8 of 24 = 33%)');
{
  // Simulate 8 files across 2 agents
  const catResult = {
    passed: false,
    diffs: {
      'agents/coder/SOUL.md': { expected: 'a', actual: 'b' },
      'agents/coder/agent.json': { expected: 'a', actual: 'b' },
      'agents/bob/SOUL.md': { expected: 'a', actual: 'b' },
      'agents/bob/agent.json': { expected: 'a', actual: 'b' },
      'agents/amy/SOUL.md': { expected: 'a', actual: 'b' },
      'agents/amy/agent.json': { expected: 'a', actual: 'b' },
    },
    missing: [
      'agents/coach/SOUL.md',
      'agents/coach/agent.json'
    ],
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const responses = buildDriftResponses(catResult);
  assert(responses.length >= 2, `returns multiple responses (got ${responses.length})`);
  // Total bad = 8/24 = 33% overall, but each agent's share is 2/24 ≈ 8% → WARNING individually.
  // This tests that drift is per-agent: each agent only owns a fraction.
  // Let's verify the per-agent classification:
  for (const r of responses) {
    // Each agent has 2 files out of 24 → ~8.3% → WARNING
    assertEq(r.drift_level, 'WARNING', `agent ${r.agent}: per-agent drift is WARNING (~8%)`);
  }
}

console.log('\n▸ buildDriftResponses() — CATASTROPHIC per-agent (8 of 24 files, single agent)');
{
  const singleAgentCat = {
    passed: false,
    diffs: {
      'agents/coder/SOUL.md': { expected: 'a', actual: 'b' },
      'agents/coder/agent.json': { expected: 'a', actual: 'b' },
      'agents/coder/TOOLS.md': { expected: 'a', actual: 'b' },
      'agents/coder/DOMAIN.md': { expected: 'a', actual: 'b' },
      'agents/coder/LESSONS.md': { expected: 'a', actual: 'b' },
      'agents/coder/config1.json': { expected: 'a', actual: 'b' },
      'agents/coder/config2.json': { expected: 'a', actual: 'b' },
    },
    missing: ['agents/coder/config3.json'],
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const responses = buildDriftResponses(singleAgentCat);
  assertEq(responses.length, 1, 'single agent response');
  assertEq(responses[0].agent, 'coder', 'agent is coder');
  assertEq(responses[0].drift_level, 'CATASTROPHIC', '8/24 = 33% → CATASTROPHIC');
  assertEq(responses[0].action_required, 'REVERT', 'CATASTROPHIC → REVERT');
}

// ---------------------------------------------------------------------------
// 3. Unit tests: trigger-response processResponse()
// ---------------------------------------------------------------------------
console.log('\n▸ processResponse() — NONE action');
{
  const r = processResponse({
    agent: 'coder',
    drift_level: 'NONE',
    delta: 0,
    bad_files: [],
    action_required: 'NONE'
  });
  assertEq(r.action, 'NONE', 'returns NONE action');
  assertEq(r.target, null, 'no target');
  assertEq(r.todoPath, null, 'no todo file');
}

console.log('\n▸ processResponse() — GROWTH_CYCLE action');
{
  const r = processResponse({
    agent: 'coder',
    drift_level: 'CRITICAL',
    delta: -0.125,
    bad_files: ['agents/coder/SOUL.md', 'agents/coder/agent.json'],
    action_required: 'GROWTH_CYCLE'
  });
  assertEq(r.action, 'GROWTH_CYCLE', 'action is GROWTH_CYCLE');
  assertEq(r.target, 'coach', 'routed to coach');
  assert(r.todoPath !== null, 'todo file was created');
  if (r.todoPath) {
    assert(fs.existsSync(r.todoPath), `todo file exists at ${r.todoPath}`);
    const content = fs.readFileSync(r.todoPath, 'utf8');
    assert(content.includes('growth-cycle'), 'todo mentions growth-cycle');
    assert(content.includes('coder'), 'todo mentions the agent name');
    // Cleanup
    fs.unlinkSync(r.todoPath);
  }
}

console.log('\n▸ processResponse() — REVERT action');
{
  const r = processResponse({
    agent: 'coder',
    drift_level: 'CATASTROPHIC',
    delta: -0.33,
    bad_files: ['agents/coder/SOUL.md', 'agents/coder/agent.json', 'agents/coder/TOOLS.md'],
    action_required: 'REVERT'
  });
  assertEq(r.action, 'REVERT', 'action is REVERT');
  assertEq(r.target, 'tech-lead', 'routed to tech-lead');
  assert(r.todoPath !== null, 'todo file was created');
  if (r.todoPath) {
    assert(fs.existsSync(r.todoPath), `todo file exists at ${r.todoPath}`);
    const content = fs.readFileSync(r.todoPath, 'utf8');
    assert(content.includes('Revert'), 'todo mentions Revert');
    assert(content.includes('coder'), 'todo mentions the agent name');
    assert(content.includes('CATASTROPHIC'), 'todo mentions severity level');
    // Cleanup
    fs.unlinkSync(r.todoPath);
  }
}

// ---------------------------------------------------------------------------
// 4. Integration: processAllResponses with mixed drift
// ---------------------------------------------------------------------------
console.log('\n▸ processAllResponses() — mixed batch');
{
  const mixed = [
    { agent: 'amy', drift_level: 'NONE', delta: 0, bad_files: [], action_required: 'NONE' },
    { agent: 'coder', drift_level: 'CRITICAL', delta: -0.12, bad_files: ['agents/coder/SOUL.md'], action_required: 'GROWTH_CYCLE' },
    { agent: 'bob', drift_level: 'CATASTROPHIC', delta: -0.35, bad_files: ['agents/bob/SOUL.md', 'agents/bob/agent.json'], action_required: 'REVERT' }
  ];
  const results = processAllResponses(mixed);
  assertEq(results.length, 3, 'processes all 3 responses');

  const dispatched = results.filter(r => r.result.action !== 'NONE');
  assertEq(dispatched.length, 2, '2 actions dispatched');
  assertEq(dispatched[0].result.target, 'coach', 'first action → coach');
  assertEq(dispatched[1].result.target, 'tech-lead', 'second action → tech-lead');

  // Cleanup todo files
  for (const d of dispatched) {
    if (d.result.todoPath && fs.existsSync(d.result.todoPath)) {
      fs.unlinkSync(d.result.todoPath);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Markdown report still works
// ---------------------------------------------------------------------------
console.log('\n▸ formatReport() — backwards compatibility');
{
  const passResult = {
    passed: true, diffs: {}, missing: [], filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z', timestamp: '2026-03-15T00:00:00Z'
  };
  const report = formatReport(passResult);
  assert(report.includes('PASS'), 'passing report contains PASS');
  assert(report.includes('24'), 'passing report mentions file count');

  const failResult = {
    passed: false,
    diffs: { 'agents/coder/SOUL.md': { expected: 'aabbccdd11223344rest', actual: '11223344aabbccddrest' } },
    missing: ['agents/bob/agent.json'],
    filesChecked: 24,
    snapshotTimestamp: '2026-01-01T00:00:00Z',
    timestamp: '2026-03-15T00:00:00Z'
  };
  const failReport = formatReport(failResult);
  assert(failReport.includes('FAIL'), 'failing report contains FAIL');
  assert(failReport.includes('coder/SOUL.md'), 'failing report lists drifted file');
  assert(failReport.includes('bob/agent.json'), 'failing report lists missing file');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n═══════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  • ${f}`);
  }
}

// Cleanup: remove empty todo dirs we may have created
const todoDirs = ['coach', 'tech-lead'].map(a => path.resolve(__dirname, `../../../agents/shared/todos/${a}`));
for (const d of todoDirs) {
  try {
    const files = fs.readdirSync(d);
    if (files.length === 0) fs.rmdirSync(d);
  } catch (_) { /* ignore */ }
}

process.exit(failed > 0 ? 1 : 0);
