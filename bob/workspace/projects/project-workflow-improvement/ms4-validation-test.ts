/**
 * MS4 Validation: Evaluator Auto-Advance Cap
 * 
 * Tests the core logic from project.ts handleWaitingDecision():
 * - After 2+ evaluator FAILs, auto-advance to WAITING instead of CONTINUE
 * - Validates against real journal data from pwi-smart-context and reviewer-effectiveness
 */

// ── Core logic extracted from project.ts (lines 552-564) ──

function shouldAutoAdvance(journalContent: string, currentScore: number): {
  action: "auto-advance" | "override-to-continue" | "pass";
  prevFails: number;
} {
  if (currentScore >= 7) return { action: "pass", prevFails: 0 };
  
  const prevFails = (journalContent.match(/\*\*Evaluator\*\*: FAIL/g) || []).length;
  const maxEvalAttempts = 2;
  
  if (prevFails + 1 >= maxEvalAttempts) {
    return { action: "auto-advance", prevFails };
  }
  return { action: "override-to-continue", prevFails };
}

// ── Test cases ──

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log("\n=== MS4 Validation: Evaluator Auto-Advance Cap ===\n");

// Test 1: First FAIL → override to CONTINUE (no previous fails)
console.log("Test Group 1: Basic logic");
test("First FAIL overrides to CONTINUE", () => {
  const result = shouldAutoAdvance("", 5);
  assert(result.action === "override-to-continue", `Expected override-to-continue, got ${result.action}`);
  assert(result.prevFails === 0, `Expected 0 prevFails, got ${result.prevFails}`);
});

// Test 2: Second FAIL → auto-advance
test("Second FAIL auto-advances to WAITING", () => {
  const journal = `**Evaluator**: FAIL (score=5/10) — overriding WAITING to CONTINUE.\n`;
  const result = shouldAutoAdvance(journal, 6);
  assert(result.action === "auto-advance", `Expected auto-advance, got ${result.action}`);
  assert(result.prevFails === 1, `Expected 1 prevFails, got ${result.prevFails}`);
});

// Test 3: PASS always passes
test("Score >= 7 always passes", () => {
  const journal = `**Evaluator**: FAIL (score=5/10)\n**Evaluator**: FAIL (score=6/10)\n`;
  const result = shouldAutoAdvance(journal, 8);
  assert(result.action === "pass", `Expected pass, got ${result.action}`);
});

// Test 4: Three previous FAILs → definitely auto-advance
test("Third+ FAIL auto-advances", () => {
  const journal = `**Evaluator**: FAIL (score=5/10)\n**Evaluator**: FAIL (score=6/10)\n**Evaluator**: FAIL (score=6/10)\n`;
  const result = shouldAutoAdvance(journal, 4);
  assert(result.action === "auto-advance", `Expected auto-advance, got ${result.action}`);
  assert(result.prevFails === 3, `Expected 3 prevFails, got ${result.prevFails}`);
});

// ── Real project validation ──

import { readFileSync, existsSync } from "node:fs";

console.log("\nTest Group 2: Real project replay — pwi-smart-context");

const pwiJournalPath = "agents/bob/workspace/projects/pwi-smart-context/journal.md";
if (existsSync(pwiJournalPath)) {
  const pwiJournal = readFileSync(pwiJournalPath, "utf-8");
  const fails = (pwiJournal.match(/\*\*Evaluator\*\*: FAIL/g) || []).length;
  
  test(`pwi-smart-context had ${fails} evaluator FAILs (expected 3)`, () => {
    assert(fails === 3, `Expected 3 fails, got ${fails}`);
  });
  
  // Simulate: replay each FAIL in sequence
  test("With new cap, 2nd FAIL would auto-advance (preventing 3rd stall)", () => {
    // After 1st FAIL is in journal, 2nd FAIL arrives with score=6
    const journalAfterFirstFail = `**Evaluator**: FAIL (score=5/10) — overriding WAITING to CONTINUE.\n`;
    const result = shouldAutoAdvance(journalAfterFirstFail, 6);
    assert(result.action === "auto-advance", `Expected auto-advance, got ${result.action}`);
  });
} else {
  console.log("  ⚠️  pwi-smart-context journal not found, skipping");
}

console.log("\nTest Group 3: Real project replay — reviewer-effectiveness");

const reJournalPath = "agents/bob/workspace/projects/reviewer-effectiveness/journal.md";
if (existsSync(reJournalPath)) {
  const reJournal = readFileSync(reJournalPath, "utf-8");
  const fails = (reJournal.match(/\*\*Evaluator\*\*: FAIL/g) || []).length;
  
  test(`reviewer-effectiveness had ${fails} evaluator FAILs (expected 2+)`, () => {
    assert(fails >= 2, `Expected 2+ fails, got ${fails}`);
  });
  
  test("With new cap, 2nd FAIL would auto-advance", () => {
    const journalAfterFirstFail = `**Evaluator**: FAIL (score=6/10) — overriding WAITING to CONTINUE.\n`;
    const result = shouldAutoAdvance(journalAfterFirstFail, 6);
    assert(result.action === "auto-advance", `Expected auto-advance, got ${result.action}`);
  });
} else {
  console.log("  ⚠️  reviewer-effectiveness journal not found, skipping");
}

console.log("\nTest Group 4: Real project replay — context-learning");

const clJournalPath = "agents/bob/workspace/projects/context-learning/journal.md";
if (existsSync(clJournalPath)) {
  const clJournal = readFileSync(clJournalPath, "utf-8");
  const fails = (clJournal.match(/\*\*Evaluator\*\*: FAIL/g) || []).length;
  
  test(`context-learning had ${fails} evaluator FAILs`, () => {
    assert(fails >= 1, `Expected 1+ fails, got ${fails}`);
  });
} else {
  console.log("  ⚠️  context-learning journal not found, skipping");
}

// ── Summary ──

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
