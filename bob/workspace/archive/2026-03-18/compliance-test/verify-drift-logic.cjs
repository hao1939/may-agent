// agents/bob/workspace/compliance-test/verify-drift-logic.cjs
const { analyzeDrift } = require('../../../../agents/evaluator/skills/detect-drift.cjs');

// Test 1: Stable Agent (100% baseline, 100% recent)
// 10 items total. Split 80/20 = 8 baseline, 2 recent.
const stableReceipts = [];
for (let i = 0; i < 10; i++) {
    stableReceipts.push({ agent: 'stable', tool: 'run_test', status: 'success' });
}
console.log('--- Test 1: Stable ---');
console.log(JSON.stringify(analyzeDrift(stableReceipts), null, 2));


// Test 2: Drift Agent (100% baseline, 0% recent)
// 10 items total. 8 baseline (all success), 2 recent (all failure).
const driftReceipts = [];
for (let i = 0; i < 8; i++) {
    driftReceipts.push({ agent: 'drift', tool: 'run_test', status: 'success' });
}
for (let i = 0; i < 2; i++) {
    driftReceipts.push({ agent: 'drift', tool: 'run_test', status: 'failure' });
}
console.log('\n--- Test 2: Drift ---');
console.log(JSON.stringify(analyzeDrift(driftReceipts), null, 2));


// Test 3: Mixed (50% baseline, 50% recent)
// 10 items total.
// Baseline: 4 success, 4 failure = 50%
// Recent: 1 success, 1 failure = 50%
const mixedReceipts = [];
for (let i = 0; i < 4; i++) mixedReceipts.push({ agent: 'mixed', tool: 'run_test', status: 'success' });
for (let i = 0; i < 4; i++) mixedReceipts.push({ agent: 'mixed', tool: 'run_test', status: 'failure' });
mixedReceipts.push({ agent: 'mixed', tool: 'run_test', status: 'success' });
mixedReceipts.push({ agent: 'mixed', tool: 'run_test', status: 'failure' });

console.log('\n--- Test 3: Mixed ---');
console.log(JSON.stringify(analyzeDrift(mixedReceipts), null, 2));
