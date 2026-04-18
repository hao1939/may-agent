# Finding: Implement-and-Verify Retry Mechanism Audit

**Lens:** D (Fragility)  
**Date:** 2026-04-18  
**Severity:** Low — mechanism works but shows quality degradation

## Summary

The implement-and-verify workflow (`agents/shared/workflows/implement-and-verify.ts`) uses a simple retry loop: if shell verification fails after attempt 1, it feeds the error output back to coder as "Fix Required (attempt 2/2)" and re-runs. The retry mechanism fires rarely (~3% of runs) and produces lower-quality sessions than first attempts.

## Flow Description

1. Parse task, extract `verifyCommand` (default: `tsc --noEmit && vitest --run`) — `implement-and-verify.ts:57-76`
2. Loop up to `maxAttempts` (default 2) — `implement-and-verify.ts:118`
3. Attempt 1: inject few-shot examples via `injectFewShot()`, append verification info — `implement-and-verify.ts:126-134`
4. Run `ctx.runAgent("coder", coderTask)` — `implement-and-verify.ts:148`
5. Run shell verification via `execSync()` with 2min timeout — `implement-and-verify.ts:91-112`
6. If verify fails, attempt 2 prompt includes original task + full error output — `implement-and-verify.ts:136-144`
7. If attempt 2 also fails verification → `ctx.escalate()` — `implement-and-verify.ts:172-175`

**Key design detail:** On attempt 1, coder errors get one silent retry (`implement-and-verify.ts:150-159`). On attempt 2, coder errors escalate immediately (`implement-and-verify.ts:161-165`).

## Data: Attempt 1 vs Attempt 2

| Metric | Attempt 1 | Attempt 2 |
|--------|-----------|-----------|
| Evaluated sessions | 42 | 26 |
| Avg quality | **0.78** | **0.66** |
| "good" verdict | 20 (48%) | 11 (42%) |
| "acceptable" | 20 (48%) | 9 (35%) |
| "needs_improvement" | 2 (5%) | 6 (23%) |

**Retry rate:** ~26 workflow runs needed retry out of ~884 total (~3%).  
**Quality drop:** Attempt 2 averages 0.12 lower quality than attempt 1.  
**needs_improvement 4.6x higher** in retries (23% vs 5%).

## Observed Pattern from Transcripts

From the DB transcript data, attempt-2 sessions frequently encounter **pre-existing test failures** unrelated to the coder's changes (e.g., `test/create-tool.test.ts` failures from a prior `agents.message→notify` refactor). Coder spends its retry budget diagnosing these, concluding "failures are pre-existing on HEAD" but unable to fix them (scoped to specific files). This explains much of the quality drop — the retry prompt implies the coder broke something, but the failures existed before.

## Root Cause of Low Retry Value

1. **Verification command too broad:** Default `vitest --run` runs ALL tests, not just those related to the changed files. Pre-existing failures trigger retry even when the coder's changes are correct — `implement-and-verify.ts:10` (DEFAULT_VERIFY).
2. **No pre-existing failure baseline:** The workflow doesn't snapshot test state before coder runs. Any test that was already broken counts against the coder.
3. **Retry prompt lacks context:** The "Fix Required" prompt doesn't tell coder which failures are new vs pre-existing — `implement-and-verify.ts:136-144`.

## Recommendation: KEEP with modifications

The retry mechanism earns its keep at 3% fire rate — it's cheap. But quality could improve:

1. **Run verification BEFORE attempt 1** to establish a baseline of pre-existing failures. Only fail the coder if NEW failures appear.
2. **Allow `verifyCommand` callers to scope tests** (most already do — the tech-lead context says to use specific test paths). Enforce this as guidance.
3. **In retry prompt, diff the failures** — show which test failures are new vs baseline.

These are separate tasks — do not implement here.
