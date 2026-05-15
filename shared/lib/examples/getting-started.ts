/**
 * Getting Started with the Shared Toolkit
 * 
 * This file demonstrates how to use the key utilities from shared/lib/
 * together in a realistic workflow. Import what you need from the barrel export.
 */

import {
  generateProject,
  recordIteration,
  getMetrics,
  analyzeIterations,
  detectRegressions,
  validateProjectConfig,
  createTaskTemplate,
  validateWriteFirst,
} from '../index.js';

// ─── Step 1: Generate a new project ─────────────────────────────────────────
// Use generateProject to scaffold a well-formed project.md

const project = generateProject({
  name: 'api-optimization',
  goal: 'Reduce p95 latency from 400ms to under 100ms',
  metrics: [
    { name: 'p95-latency-ms', target: '< 100' },
    { name: 'error-rate', target: '< 0.1%' },
  ],
  owner: 'backend-agent',
});

console.log('=== Generated Project ===');
console.log(project.projectMd);

// ─── Step 2: Validate the generated config ──────────────────────────────────
// Ensure the project.md has all required sections

const validation = validateProjectConfig(project.projectMd);
console.log('\n=== Config Validation ===');
console.log(`Valid: ${validation.valid}, Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`);

// ─── Step 3: Create task templates for workers ──────────────────────────────
// Explicit target paths prevent files ending up in wrong locations

const task = createTaskTemplate({
  goal: 'Implement request caching layer',
  targetPath: 'shared/lib/cache.ts',
  testPath: 'shared/lib/__tests__/cache.test.ts',
  context: 'Use LRU strategy with 1000-entry max',
});

console.log('\n=== Task Template ===');
console.log(task);

// ─── Step 4: Validate write-first compliance ────────────────────────────────
// Check that a worker's actions start with a write, not reads

const actions = ['write(lib/cache.ts)', 'write(lib/__tests__/cache.test.ts)', 'bash(bun run test)'];
const writeCheck = validateWriteFirst(actions);
console.log('\n=== Write-First Check ===');
console.log(`Valid: ${writeCheck.valid}, First action: ${writeCheck.firstAction}`);

// ─── Step 5: Record iteration outcomes ──────────────────────────────────────
// After each worker iteration, record whether it produced a deliverable

const iterationRecords = [
  { id: 'iter-1', deliverableProduced: true, firstAttempt: true, durationMs: 45000 },
  { id: 'iter-2', deliverableProduced: true, firstAttempt: true, durationMs: 32000 },
  { id: 'iter-3', deliverableProduced: false, firstAttempt: false, durationMs: 120000 },
  { id: 'iter-4', deliverableProduced: true, firstAttempt: true, durationMs: 28000 },
  { id: 'iter-5', deliverableProduced: true, firstAttempt: false, durationMs: 65000 },
];

// In real usage, call recordIteration() which persists to .state/iteration-log.json
// Here we just demonstrate the shape:
for (const record of iterationRecords) {
  // recordIteration(record);  // Uncomment to actually persist
  console.log(`Recorded: ${record.id} (delivered: ${record.deliverableProduced})`);
}

// ─── Step 6: Compute aggregate metrics ─────────────────────────────────────
// getMetrics() reads from .state/iteration-log.json
// For demo purposes, we show what the output looks like:

// const metrics = getMetrics(5);  // Last 5 iterations
// console.log(metrics);  // { deliverableRate: 0.8, firstAttemptRate: 0.6, avgDuration: 58000 }

console.log('\n=== Metrics (simulated) ===');
console.log('deliverableRate: 0.8, firstAttemptRate: 0.6, avgDuration: 58000ms');

// ─── Step 7: Analyze for patterns and suggestions ───────────────────────────
// Finds slow outliers and failure patterns

const analysis = analyzeIterations(iterationRecords.map(r => ({
  ...r,
  timestamp: Date.now(),
})));

console.log('\n=== Analysis ===');
console.log(`Slowest iterations: ${analysis.slowest.length}`);
console.log(`Patterns found: ${analysis.patterns.length}`);
console.log(`Suggestions: ${analysis.suggestions.join('; ')}`);

// ─── Step 8: Detect regressions against baseline ────────────────────────────
// Compare current metrics to a stored baseline

const baseline = { testFiles: 78, testCount: 1413, passRate: 1.0 };
const current = { testFiles: 78, testCount: 1410, passRate: 0.99 };

const regressions = detectRegressions(current, baseline, 0.05); // 5% threshold
console.log('\n=== Regression Check ===');
if (regressions.regressions.length === 0) {
  console.log('No regressions detected ✓');
} else {
  for (const r of regressions.regressions) {
    console.log(`⚠️  ${r.metric}: ${r.baseline} → ${r.current} (${(r.drop * 100).toFixed(1)}% drop)`);
  }
}
