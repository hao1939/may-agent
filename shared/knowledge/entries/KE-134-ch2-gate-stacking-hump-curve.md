# KE-134: Channel 2 Gate Stacking Follows a Hump Curve, Not a Cliff

**Status**: Active
**Source**: EXP-129 (Channel 2 Budget Curve, N=25, 4 arms)
**Date**: 2026-04-11
**Confidence**: ★★★☆ (Moderate — clear pattern but no pairwise comparison reached significance at N=6)
**Revises**: KE-064 (execution crowding generalization — now known to be task-specific, not universal)
**Related**: KE-129 (Ch2 only reliable channel), P-098c (cliff prediction — REJECTED)

---

## Core Finding

Stacking multiple forced-externalization gates on a judgment task (contradictory-requirements) does NOT produce the predicted cliff function. Instead, pass rate follows a **hump curve** peaking at 3 gates:

| Gates | Predicted (P-098c) | Observed | Duration (mean) |
|-------|:-------------------:|:--------:|:---------------:|
| 1     | ~100%              | 86% (6/7) | 253s           |
| 2     | ~50%               | 83% (5/6) | 379s           |
| 3     | ~10%               | **100% (6/6)** | 556s       |
| 4     | ~0%                | 67% (4/6) | 755s           |

**P-098c REJECTED**: The cliff function does not exist. Observed pattern is hump-shaped with peak at 3 gates.

---

## Key Insights

### 1. Related analytical gates have synergistic effects
Three gates (ANALYSIS.md + IMPACT.md + RISK.md) all target different facets of the same analytical problem. They appear to function as **planning scaffolding** that structures the agent's thinking, not as competing attention drains.

### 2. Duration cost is linear and real
Each gate adds ~167 seconds of execution time (linear, R² ≈ 1.0). At 4 gates, runs take 3× longer than 1 gate (755s vs 253s). The practical budget constraint is wall-clock time, not cognitive capacity.

### 3. Failure mode shifts at 4 gates
At 1-2 gates, failures are judgment failures (contradiction-identified = 0). At 4 gates, the failure mode shifts to implementation quality (tests-pass = 0). This suggests additional gates *improve* judgment but the extended execution time degrades implementation reliability.

### 4. KE-064 execution crowding is task-specific, not universal
The original KE-064 finding (chaining causes 0% task completion) came from a different task type. On analytical judgment tasks, the crowding threshold is much higher (≥4 gates before degradation).

---

## Revision to Prior Knowledge

**KE-064 (execution crowding)**: Revise from "chaining externalization gates causes execution crowding" to "execution crowding depends on gate relevance to task — related analytical gates synergize up to 3, unrelated gates may crowd at lower counts."

**P-098c**: REJECTED. Channel 2 budget is NOT ~1 gate per task. At least 3 related analytical gates fit within budget on judgment tasks.

---

## Production Implications

1. **Current multi-guard stack is safe**: The production guard stack (completeness, verification-depth, tool-schema, commit) has 4 guards — near the observed degradation threshold. However, these are *different types* of guards (not all analytical), so the EXP-129 hump curve may not directly apply.

2. **Multi-gate analytical workflows are viable**: Designing workflows with 2-3 related analytical steps (e.g., ANALYZE → PLAN → VALIDATE) is safe and may be beneficial.

3. **Duration is the binding constraint**: Even where pass rates hold, each gate costs ~2.5 minutes. Production timeout budgets must account for this.

---

## Mechanistic Explanation: CR-338 Cognitive Overhead Budget

CR-338 synthesizes DD-747 (Format Tax), DD-748 (BCR), and DD-671 (Structure Snowballing) to provide the **mechanistic explanation** for this hump curve. Two competing forces:

1. **Reasoning Scaffolding (positive)**: Each related analytical gate structures thinking about a different problem facet. DD-748's implicit budget mechanism shows multiple related tasks in shared context create structural pressure for efficient reasoning.
2. **Format Tax (negative)**: Each gate imposes structural overhead that consumes reasoning capacity (DD-747). At 4+ gates, format compliance exhausts capacity → DD-671's "structure snowballing" (syntactically perfect, semantically empty output).

The hump peak occurs where **marginal scaffolding benefit = marginal format tax**. This explains:
- Why 3 gates = 100%: full analytical coverage, format tax still manageable
- Why 4 gates shifts failure mode to implementation: scaffolding sufficient for judgment, but capacity exhausted for implementation
- Why KE-135's unrelated gates fail at lower counts: no scaffolding synergy, so format tax dominates earlier

**Citation**: CR-338 (Cognitive Overhead Budget, ★★★★★, 2026-04-11)

## Open Questions

1. ~~**Unrelated gates**: Would stacking unrelated gates produce the cliff that related gates don't?~~ **ANSWERED by EXP-131**: Yes — 3 unrelated gates pass at 50% vs 86% for 3 related gates (h=0.80). See KE-135 for details. The hump curve requires gate-task synergy.
2. **Different task types**: Does the hump curve hold for non-judgment tasks (implementation, discovery)?
3. **Larger N needed**: No pairwise comparison reached significance (N=6/arm). The 100% vs 67% (3 vs 4 gates) had p=0.455 — would need ~N=15/arm to detect a 33pp difference.

---

## Statistical Notes

- Fisher's exact (two-tailed): No pairwise comparison significant at α=0.05
- ABC combined (89%) vs D (67%): p = 0.234 (NS)
- All runs used coder agent, same model, same framework SHA
- Run 285 (Arm D) had scoring failure — counted as fail
- Arm A had 7 runs (extra from interrupted session), all included
