# EXP-018: Structured-Plan-Writing Skill on plan-once-amend Scenario

**Date**: 2026-04-03
**Status**: COMPLETE
**Verdict**: COUNTER-PRODUCTIVE — Skill caused timeout and missed deliverables

## Hypothesis

The `structured-plan-writing` skill, when injected as text into the coder agent's system prompt, will improve blocker-handling on the `plan-once-amend` scenario.

**Historical baseline**: 7/8 (fails: handles-blocker-efficiently)
**Fresh baseline**: 8/8 (all pass) — the gap has closed since March 25

## Results

### Fresh Baseline (no skill injection)
| Run | Summary | Score | Pass? | Status |
|-----|---------|-------|-------|--------|
| 1 | All 8 checks pass | 8/8 | ✅ PASS | success |

Prompt hash: `13ba8cdcc54b` | Duration: 261s

### Treatment (structured-plan-writing skill injected)
| Run | Summary | Score | Pass? | Status |
|-----|---------|-------|-------|--------|
| 1 | Fails session-summary-exists + error-analysis-exists | 6/8 | ❌ FAIL | **timeout** |

Prompt hash: `bf61decc5cec` | Duration: 301s (hit 5min timeout)

### Failing checks (treatment):
- ✗ `session-summary-exists` — workspace/session-summary.md not created
- ✗ `error-analysis-exists` — workspace/error-analysis.md not created
- ✓ `handles-blocker-efficiently` — ironically, the targeted behavior passed
- ✓ All other behavioral + efficiency checks passed

## Analysis

### The Over-Planning Trap
The structured-plan-writing skill triggered **Anti-Pattern AP-5** from its own documentation: "Agent spends 40% of session writing a perfect plan and 60% executing. The plan was beautiful but there wasn't enough time to finish the work."

The agent spent significant time:
1. Reading the skill instructions
2. Decomposing the task into atomic steps with dependencies
3. Identifying risks for each step
4. Writing checkpoints
5. Materializing the full plan

This consumed enough budget that the agent timed out before producing 2 of 3 deliverables.

### Ironic Result
The skill's own anti-pattern section warns against exactly this failure mode, but the agent followed the skill's positive instructions (DECOMPOSE → ORDER → RISK → CHECKPOINT → WRITE IT DOWN) so diligently that it fell into the trap the skill warned against.

### Baseline Already at Ceiling
The fresh baseline scored 8/8, meaning the historical 7/8 gap has naturally closed (likely due to model improvements or system prompt changes since March 25). There was no gap for the skill to close.

## Implications

1. **Text-injection track record**: Now 0/20 successes. This is the first that was actively HARMFUL (reducing score from 8/8 to 6/8).
2. **Over-planning is a real risk**: Skills that add pre-execution protocol steps consume budget. For a 5-minute scenario, a 5-step planning protocol is too expensive.
3. **Skill needs a "budget gate"**: The structured-plan-writing skill should have a stronger budget gate — e.g., "If total session time is under 5 minutes, use the abbreviated version (Steps 1 and 5 only, skip 2-4)."
4. **Anti-Pattern AP-5 needs to be the PRIMARY warning**, not just one of five anti-patterns.
5. **plan-once-amend scenario is now at ceiling** — not suitable for skill testing.

## Action Items
- [ ] Mark plan-once-amend as ceiling in experiments.jsonl
- [x] Record this as the first HARMFUL text injection result
- [ ] Consider adding budget-awareness to structured-plan-writing skill
