# Growth Receipt: tech-lead FM-3.3 Verification Fix

**Date**: 2026-04-02  
**Agent**: tech-lead  
**Error Pattern**: FM-3.3 (VERIFICATION_FAILURE / VERIFICATION_GAP)  
**Error Count**: 15 in 7 days  
**Coach Session**: s_1775149578174_157

## Error Analysis

15 FM-3.3 errors broken down by sub-pattern:
- **10 errors** (Mar 30): vitest mentioned in tasks but never executed / no structural evidence
- **4 errors** (Mar 30): claimed specific tests pass without showing output  
- **3 errors** (Mar 14-15): skipped tsc compilation check
- **2 errors** (Mar 14): incomplete verification within session
- **1 error** (Apr 1): no post-write verification at all

**Root cause**: Tech-lead delegates bug-fix tasks to coder with instructions to verify, but coder doesn't actually run the verification commands. Tech-lead then accepts coder's summary as evidence without checking.

## Experiments Run

### Baseline (2 runs each)
| Scenario | Score | Verdict |
|---|---|---|
| verify-before-finish | 7/7 | CEILING |
| skip-verification | 5/5 | CEILING |
| partial-verification-trap | 5/6 | NON-CEILING |

**partial-verification-trap** consistently fails `added-edge-case-test` — agent fixes the bug but doesn't add a regression test for the exact scenario the user reported. This maps directly to FM-3.3: "partial verification, fixed code but didn't prove the specific fix."

### Treatment 1: Skill-only (bug-report-test-coverage)
- **Result**: 5/6 — NO IMPROVEMENT
- Added a skill telling the agent to add edge case tests after fixing bugs
- Agent read the skill but didn't follow through
- **Confirms**: SOUL.md/skill text changes don't fix judgment failures (matches 0/18 finding)

### Treatment 2: Workflow variant (two-phase prompt)
- **Result**: 6/6 (2/2 runs) — FULL IMPROVEMENT
- Two-phase prompt: first fix the bug, then explicitly review test coverage
- Structural separation of "fix" and "verify coverage" phases works

### Treatment Applied: Context.md patch
Added to tech-lead's context.md:
1. Use `verified-coder` workflow for ALL bug-fix delegation (not raw agents.call) — workflow runs verification externally
2. After any direct file edit, must run verification (tsc + tests) before finish() — exit code 0 required

## Decision: PROMOTED

Context.md patch applied because:
- Workflow enforcement works (6/6 vs 5/6 baseline)
- Skill-only approach fails (confirmed in this cycle)
- Context.md is the right place for environmental/procedural knowledge per code-vs-data-decisions.md

## Monitoring

Watch for FM-3.3 errors over next 7 days. If count drops below 5, treatment is effective.
If no improvement, escalate to workflow-level enforcement (modify implement-and-review.ts to include automated verification step).
