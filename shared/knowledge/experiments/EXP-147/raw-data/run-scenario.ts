#!/usr/bin/env bun
/**
 * EXP-147 Track B Phase 1 Runner - Resumable version
 * 
 * Usage: bun run-scenario.ts <scenario> <output_jsonl> [start_run]
 * start_run: 1-indexed run number to start from (default: 1)
 */
import { readFileSync, writeFileSync, copyFileSync, appendFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const scenario = process.argv[2];
const outputFile = process.argv[3];
const startRun = parseInt(process.argv[4] || '1');

if (!scenario || !outputFile) {
  console.error('Usage: bun run-scenario.ts <scenario> <output_jsonl> [start_run]');
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
  (a: any) => a.scenario === scenario && a.run_number >= startRun
);

// Count existing records to set index correctly
let existingCount = 0;
if (existsSync(outputFile)) {
  const existing = readFileSync(outputFile, 'utf8').trim().split('\n').filter(Boolean);
  existingCount = existing.filter(l => {
    try { return JSON.parse(l).scenario === scenario; } catch { return false; }
  }).length;
}

console.log(`\n=== Running ${scenario}: ${assignments.length} runs (starting run ${startRun}, ${existingCount} existing) ===\n`);

let runIndex = existingCount;
for (const assignment of assignments) {
  const { run_number, condition } = assignment;
  
  // Swap context
  if (condition === 'scoped') {
    copyFileSync(contextScoped, contextTarget);
  } else {
    copyFileSync(contextFull, contextTarget);
  }
  
  const startTime = Date.now();
  let output = '';
  
  try {
    output = execSync(`scripts/gym-run.sh ${scenario} --agent bob`, {
      encoding: 'utf8',
      timeout: 180_000,
      env: { ...process.env, PATH: `.state/.bun/bin:${process.env.PATH}` }
    });
  } catch (e: any) {
    output = e.stdout || e.stderr || '';
  }
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  let passed = false;
  let dbRunId = 'unknown';
  
  const jsonMatch = output.match(/"passed"\s*:\s*(true|false)/);
  if (jsonMatch) {
    passed = jsonMatch[1] === 'true';
  } else if (output.includes('PASS') || output.includes('✓')) {
    passed = true;
  }
  
  const runIdMatch = output.match(/"run_id"\s*:\s*(\d+)/);
  if (runIdMatch) dbRunId = runIdMatch[1];
  
  const record = { scenario, run: run_number, condition, passed, elapsed, db_run_id: dbRunId, index: runIndex };
  appendFileSync(outputFile, JSON.stringify(record) + '\n');
  
  const icon = passed ? '✅' : '❌';
  console.log(`Run ${run_number} [${condition}] ${icon} ${elapsed}s`);
  
  runIndex++;
}

// Restore original context
writeFileSync(contextTarget, originalContext);
console.log(`\nRestored context.md. ${scenario} complete: ${runIndex} total runs.`);
