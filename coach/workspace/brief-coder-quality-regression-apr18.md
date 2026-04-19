# Coder Quality Regression Brief — Apr 18, 2026

## Current Metric
- **7-day rolling avg**: 0.802 (target: 0.82)
- **Trend**: Declining. Apr 17 avg 0.718 (n=23), Apr 18 avg 0.703 (n=11)

## Daily Quality Trajectory
| Date | n | Avg Quality |
|------|---|-------------|
| Apr 11-13 | 17 | ~0.99 |
| Apr 14 | 12 | 0.650 |
| Apr 15 | 32 | 0.729 |
| Apr 16 | 102 | 0.849 |
| Apr 17 | 23 | 0.718 |
| Apr 18 | 11 | 0.703 |

Note: Apr 11-13 had very small n (high variance). The true baseline is likely Apr 16 at 0.849 with n=102.

## Top Failure Patterns (from 30 low-quality sessions, Apr 14-18)

### 1. FM-3.3 / Verification Failure (25/30 sessions, 83%)
Nearly every low-quality session shows the coder attempting `finish(success)` without post-write verification. The finish guard catches and blocks this, but coder then burns cycles retrying with tweaked claims rather than actually running verification commands. This is the **dominant driver**.

### 2. FM-3.1 / Ghost Deliverable (8/30, 27%)
Claiming code changes or test fixes that don't exist in the session transcript. Often co-occurs with FM-3.3 — coder claims work was done, guard blocks, coder retries with slightly different wording.

### 3. Scope Violation / Drift (9/30, 30%)
Editing files outside the allowed scope, or doing tangential work instead of the task (e.g., writing reports instead of fixing code, investigating unrelated files).

### 4. FM-2.6 / Reasoning-Action Mismatch (6/30, 20%)
Task asks for X (e.g., fix verification command), coder does Y (e.g., writes analysis, edits wrong files, narrows scope).

### 5. FM-1.3 / Recovery Friction (5/30, 17%)
Git flailing (gitignored paths, reset on dirty tree), grep failures on wrong paths, wasted recovery cycles.

## What Changed?
The Apr 16 spike (n=102) includes many gym scenario runs — several with q=0.0-0.35. These are structured multi-step tasks (cascading-fix-trap, plan-then-fix) where the coder consistently:
1. Skips required verification commands
2. Attempts premature `finish(success)` 
3. Gets blocked by guards, then flails instead of doing the work

Apr 17-18 show the same pattern in production tasks. The finish guard is catching failures but not preventing them — coder wastes 3-5 calls fighting the guard instead of running `vitest`/`tsc`.

## Root Cause Assessment
**FM-3.3 (verification failure) is responsible for ~83% of low-quality sessions.** The finish guard blocks premature success, but the coder's response is to retry finish() with different wording rather than actually verify. This "retry the gate" behavior is the core problem.

The guard is working as designed (preventing false success claims) but creating a secondary failure mode: wasted ops on retry storms.

## Recommendation
1. **Do NOT resume prove-the-loop** — the signal is real now (0.703 on Apr 18) and the cause is identifiable.
2. **Target FM-3.3 retry behavior** — The intervention should make "run the verification command" the path of least resistance when finish() is blocked, rather than "tweak the summary and retry."
3. **Possible structural fix**: When finish guard blocks for verification failure, inject the specific verification command from the task into the rejection message so coder can copy-paste it. This is structural (changes guard behavior), not text-based.
4. **Skip text/SOUL.md interventions** — per KE-002, 0% success rate for judgment failures.

## prove-the-loop Status
Should remain **paused** on its original goal (generic quality improvement) but this specific regression warrants a **targeted experiment** on FM-3.3 retry behavior.
