# H-085: Prompt Overhead — Forced Externalization Can Increase Cost Without Improving Quality

**Status**: SUPPORTED — resolved from EXP-050 evidence (2026-10-13)
**Resolution**: Confirmed. Forced externalization adds 1.76-2.85x duration with zero quality improvement for well-scoped tasks. Evidence from 3 scenarios, multiple runs each.
**Priority**: Medium — affects workflow design decisions
**Proposed by**: Tech-Lead
**Date**: 2026-04-07

## Hypothesis

**Adding "forced externalization" instructions (e.g., "outline your approach before starting") to agent prompts increases task duration without proportionally improving task quality for well-scoped tasks.**

The agent's internal reasoning is already sufficient for tasks within its competence. External planning adds token generation overhead (thinking time) that scales with task complexity but only improves outcomes for tasks ABOVE the agent's unguided competence threshold.

## Evidence (EXP-050)

### phantom-fix (medium complexity, 6 tests to fix)

| Condition | Duration | Ops | Quality |
|-----------|----------|-----|---------|
| Baseline (no externalization) | 29.3s avg | 8.3 avg | 6/6 ✓ |
| With "State Approach" prompt | 83.6s avg | 15.0 avg | 6/6 ✓ |
| With verify info only | 25.2s | 8 | 6/6 ✓ |

The forced externalization added **2.85x duration** and **1.8x ops** with **zero quality improvement**.

### convention-verify-edit (trivial task)

| Condition | Duration | Ops | Quality |
|-----------|----------|-----|---------|
| Baseline | 20.9s avg | 4 | 5/5 ✓ |
| With "State Approach" | 19.6s | 4 | 5/5 ✓ |

**No effect** — the agent simply ignored the externalization instruction on a trivial task.

### drudgery-multi-file (medium task, multi-file)

| Condition | Duration | Ops | Quality |
|-----------|----------|-----|---------|
| Baseline | 48.6s | 16 | 7/7 ✓ |
| With "State Approach" | 85.6s | 14 | 7/7 ✓ |

**1.76x slower, 2 fewer ops.** The planning may have eliminated unnecessary steps, but the thinking time increase dominated.

## Mechanism

Forced externalization likely:
1. **Adds a planning turn** before implementation (~10-20s for the planning text generation)
2. **Changes the agent's tool-use pattern** — more reads before edits, more verification steps
3. **Creates longer context** — the planning text stays in the context window, slowing subsequent turns
4. **Is ignored for trivial tasks** — the agent recognizes trivially scoped tasks and skips planning

## Predictions

### P1: Externalization helps when task is ABOVE agent competence threshold
- **Test**: Find gym scenarios where baseline coder FAILS (e.g., ≤6/9 score). Add forced externalization. 
- **Expected**: Quality improves for failing scenarios, no improvement for passing ones

### P2: Externalization overhead is proportional to task complexity
- **Test**: Measure externalization overhead across 10+ scenarios of varying complexity
- **Expected**: Overhead (treatment_duration / baseline_duration) increases with task complexity

### P3: Selective externalization outperforms blanket externalization
- **Test**: Only externalize when the task mentions multiple files, has >3 steps, or involves unfamiliar patterns
- **Expected**: Selective externalization achieves same quality as blanket but with lower average overhead

## Implications for Workflow Design

1. **Remove blanket "State Approach" from implement-and-verify** — it's pure overhead for well-scoped tasks
2. **Consider conditional externalization** — only for tasks above a complexity threshold
3. **Prompt overhead is a hidden form of C_fixed** — it must be counted in workflow cost analysis alongside orchestration ops
