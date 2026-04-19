# Growth Cycle: misleading-test-fix Hard Gate Diagnosis & Method Selection

**Date**: 2026-04-14
**Status**: DIAGNOSIS COMPLETE — ready for implementation
**Related**: EXP-156 (design), EXP-016 (soft workflow 100%), EXP-127/155 (hard gate precedents)

## 1. Error Pattern

**FM Code**: FM-2.6 (Reasoning-action mismatch / misdiagnosis)  
**Description**: Agent blindly trusts test assertions. When 3 tests fail, the agent fixes all 3 in the source code — but one test has a **wrong expected value** (27.17 instead of 27.18). The code's `applyDiscount(33.97, 20)` correctly returns 27.18 via `Math.round((33.97 * 0.80) * 100) / 100 = 27.18`. The agent modifies correct code to produce the wrong answer.

**Root cause**: The agent skips independent verification. It sees "test expects X, code produces Y, X ≠ Y" and defaults to "fix the code" without checking which value is mathematically correct. This is a **judgment/diagnosis failure** — the agent has the capability to do the math but doesn't bother.

**Historical baseline**: 0% pass rate over 28+ runs (all checks fail because corrupting `applyDiscount` causes cascading failures across discount-related checks).

**Note on baseline discrepancy**: The scenario.json says `baseline_score: 5/8` and some experiment entries show 5/8. The 0% figure from recent sweeps may reflect a stricter scoring or different agent state. The 28-run 0% is the most recent/reliable data.

## 2. Target Agent

**Agent**: `coder`  
**Agent config**: `agents/coder/agent.json` — extends `_archetypes/coder`

## 3. Selected Method

**Method #15: Workflow Enforcement** (specifically: **Ch2 Hard Externalization Gate**)

This is the strongest variant of workflow enforcement — not just a soft "write analysis first" instruction in the task, but a **mandatory deliverable with existence check**. The agent must create a VERIFICATION.md (or DIAGNOSIS.md) file with independent calculations before being allowed to modify source code.

## 4. Why This Method

### Evidence hierarchy makes this clear:

| Method | Evidence for this scenario | Expected outcome |
|--------|---------------------------|------------------|
| Text-based (SOUL.md, #1-3, #6, #9-14) | 0/32+ experiments across all text methods | 0% — confirmed ineffective |
| SOUL.md with "tests can be wrong" rule | 5/8 (1 trial, lab fork `coder-misleading-fix`) | Insufficient — still fails 3/8 checks |
| Skill file (#4) | Works for tool-choice, NOT judgment | Low confidence for diagnosis tasks |
| Soft workflow (#15, task restructuring) | 100% (11/11, 2 runs, `misleading-test-fix-workflow`) | **Already proven — but no hard gate** |
| Hard gate (#15, Ch2 forced externalization) | 100% on hidden-dep (+85pp), 100% on contradictory-req (+100pp) | **Highest confidence** |

### Specific reasoning:

1. **This is a judgment/diagnosis failure**, not a tool-choice or procedural habit issue. Per the evidence hierarchy: Skills → tool-choice; Workflows → judgment. Method #15 is correct.

2. **Text-based SOUL.md intervention already failed**. The existing lab fork at `agents/.lab/coder-misleading-fix/` adds a ⛔ MANDATORY WORKFLOW with explicit "calculate the correct answer independently" and "HARD RULE: Tests Can Be Wrong." Despite this aggressive text, the experiment log shows `0/1 same as baseline` — confirming KE-002 (text rules have 0% success for judgment failures).

3. **Soft workflow already works at 100%**. The `misleading-test-fix-workflow` scenario proves the failure mode IS fixable via externalization. The soft task.md restructuring (Phase 1: diagnose → Phase 2: fix) achieved 11/11 across 2 runs. The hard gate would add enforcement (existence check) on top of this proven approach.

4. **Hard gates generalize** (EXP-155: +85pp, EXP-127: +100pp). The question EXP-156 asks is whether this generalizes to a math-verification scenario. The answer is almost certainly yes given the soft workflow already works.

5. **The previous SOUL.md fork demonstrates the exact failure mode KE-002 documents**: the agent reads the instruction to "calculate independently," then ignores it under task momentum. Only mechanical enforcement (separate deliverable phase) prevents this.

## 5. Gym Scenarios to Test

| Scenario | Purpose | Expected N |
|----------|---------|------------|
| `misleading-test-fix` | Baseline confirmation (0% over 28 runs, 1-2 trials sufficient) | 2 |
| Hard gate variant (new scenario or lab fork) | Treatment: forced DIAGNOSIS.md before code edits | 3 |

### Regression check scenarios:
- `cascade-judgment` (100% baseline — verify no regression)
- `multi-bug-pivot` (100% baseline — verify no regression)

## 6. What Specifically to Change

### Option A: Lab fork with modified task.md (recommended)

Create a new lab fork `agents/.lab/coder-hard-gate-misleading/` that modifies the **scenario's task.md** (not the agent's SOUL.md). This is the Ch2 approach — the gate is in the task structure, not the agent configuration.

**task.md for hard gate variant:**
```markdown
# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests.

## Phase 1: REQUIRED — Independent Diagnosis (write DIAGNOSIS.md)

Run the test suite:
```
node test/invoice-tests.js
```

For EACH failing test, create `DIAGNOSIS.md` with:
1. The test's expected value
2. The code's actual output
3. YOUR independent calculation (show arithmetic step by step)
4. Verdict: BUG IN CODE or BUG IN TEST

⚠️ You MUST create DIAGNOSIS.md before editing any .js file.
⚠️ If your independent calculation disagrees with the test's expected value, the TEST is wrong.

## Phase 2: Fix Based on Diagnosis

Read your DIAGNOSIS.md. For each failing test:
- If CODE BUG → fix the source code
- If TEST BUG → fix the test assertion (not the code!)

Run the full test suite to verify all tests pass.

Source: `src/invoice.js` | Tests: `test/invoice-tests.js`
```

### Option B: New gym scenario (for full EXP-156)

Create `agents/gym/scenarios/exp156-misleading-test-hard-gate/` as a separate scenario with:
- Modified task.md (as above)
- Additional success_criteria checks for DIAGNOSIS.md existence and content
- Same environment files as `misleading-test-fix`

### Recommended approach: Option B (new scenario)

This is cleaner for EXP-156's statistical design, allows A/B comparison without lab fork complexity, and adds process checks (diagnosis-exists, diagnosis-identifies-test-bug).

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Hard gate adds overhead, agent times out | Low (5min timeout, simple math) | Monitor first trial timing |
| Agent writes DIAGNOSIS.md but still corrupts code | Low (EXP-155/127 show hard gates prevent this) | Check applyDiscount-not-modified |
| No improvement over soft workflow | Medium (soft already at 100%) | This tests generalization, not incremental gain |
| Regression on other scenarios | Very low (task change, not agent change) | Regression check against passing scenarios |

## 8. Connection to Knowledge Base

- **KE-002**: Text rules 0% for judgment → confirmed by `coder-misleading-fix` SOUL.md failure
- **KE-129**: Ch2 (forced externalization) only reliable channel for judgment tasks
- **EXP-156**: This growth cycle IS Phase 1 of EXP-156 (misleading-test-fix arm)
- **EXP-016**: Soft workflow precedent (100%) — hard gate should match or exceed

## Next Steps

1. Create the hard gate scenario (`exp156-misleading-test-hard-gate`)
2. Run 2 baseline trials of `misleading-test-fix` to confirm recent 0% rate
3. Run 3 treatment trials of hard gate variant
4. Compare and write results
5. If ≥20pp improvement → candidate for promotion (modify default scenario task.md)
