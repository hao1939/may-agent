#!/usr/bin/env bun
/**
 * EXP-147 Track B Phase 1 Runner
 * Runs gym scenarios with context swapping based on assignment table.
 * 
 * Usage: bun run-scenario.ts <scenario> <output_jsonl>
 */
import { readFileSync, writeFileSync, copyFileSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';

const scenario = process.argv[2];
const outputFile = process.argv[3];

if (!scenario || !outputFile) {
  console.error('Usage: bun run-scenario.ts <scenario> <output_jsonl>');
  process.exit(1);
}

const BASE = 'agents/shared/knowledge/experiments/EXP-147/raw-data';
const assignmentTable = JSON.parse(readFileSync(`${BASE}/assignment-table.json`, 'utf8'));
const contextFull = `${BASE}/context-full.md`;
const contextScoped = `${BASE}/context-scoped.md`;
const contextTarget = 'agents/bob/context.md';

// Backup original
const originalContext = readFileSync(contextTarget);

const assignments = assignmentTable.assignments.filter(
  (a: any) => a.scenario === scenario
);

console.log(`\n=== Running ${scenario}: ${assignments.length} runs ===\n`);

let runIndex = 0;
for (const assignment of assignments) {
  const { run_number, condition } = assignment;
  
  // Swap context
  if (condition === 'scoped') {
    copyFileSync(contextScoped, contextTarget);
  } else {
    copyFileSync(contextFull, contextTarget);
  }
  
  // Verify swap
  const swappedSize = readFileSync(contextTarget).length;
  const expectedSize = condition === 'scoped' ? 475 : 3574;
  console.log(`Run ${run_number} [${condition}] ctx=${swappedSize}b (expect ~${expectedSize})`);
  
  const startTime = Date.now();
  let output = '';
  let exitCode = 0;
  
  try {
    output = execSync(`scripts/gym-run.sh ${scenario} --agent bob`, {
      encoding: 'utf8',
      timeout: 180_000, // 3 min timeout per run
      env: { ...process.env, PATH: `.state/.bun/bin:${process.env.PATH}` }
    });
  } catch (e: any) {
    output = e.stdout || e.stderr || '';
    exitCode = e.status || 1;
  }
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  // Parse pass/fail from JSON output
  let passed = false;
  let dbRunId = 'unknown';
  
  // Try to find JSON result in output
  const jsonMatch = output.match(/"passed"\s*:\s*(true|false)/);
  if (jsonMatch) {
    passed = jsonMatch[1] === 'true';
  } else if (output.includes('PASS') || output.includes('✓')) {
    passed = true;
  }
  
  const runIdMatch = output.match(/"run_id"\s*:\s*(\d+)/);
  if (runIdMatch) {
    dbRunId = runIdMatch[1];
  }
  
  const record = {
    scenario,
    run: run_number,
    condition,
    passed,
    elapsed,
    db_run_id: dbRunId,
    index: runIndex
  };
  
  appendFileSync(outputFile, JSON.stringify(record) + '\n');
  
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} passed=${passed} elapsed=${elapsed}s db_run_id=${dbRunId}`);
  
  runIndex++;
}

// Restore original context
writeFileSync(contextTarget, originalContext);
console.log(`\nRestored context.md (${originalContext.length} bytes)`);
console.log(`=== ${scenario} complete: ${runIndex} runs → ${outputFile} ===`);
