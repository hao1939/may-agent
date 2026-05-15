# EXP-850: Arm B & C Results — Efficiency Nudge Comparison

**Date**: 2026-05-05  
**Status**: COMPLETE  
**Scenario**: `multi-file-refactor`

## Arms Tested

| Arm | Description | Trials |
|-----|-------------|--------|
| A (baseline) | No efficiency instruction | 5 (from phase0-baseline-rerun) |
| B (vague nudge) | "Try to be efficient" | 5 (1 standalone + 4 batch) |
| C (concrete budget) | Specific tool-call budget/threshold | 5 |

## Duration Results

### Arm A — Baseline (no nudge)
| Trial | Duration |
|-------|----------|
| 1 | 19.1s |
| 2 | 12.7s |
| 3 | 20.7s |
| 4 | 22.3s |
| 5 | 19.7s |
**Mean: 18.9s | Median: 19.7s**

### Arm B — Vague Efficiency Nudge
| Trial | Duration |
|-------|----------|
| 1 | 19.7s |
| 2 | 23.5s |
| 3 | 17.4s |
| 4 | 23.1s |
| 5 | 19.9s |
**Mean: 20.7s | Median: 19.9s**

### Arm C — Concrete Budget
| Trial | Duration |
|-------|----------|
| 1 | 18.5s |
| 2 | 23.1s |
| 3 | 25.4s |
| 4 | 17.4s |
| 5 | 14.4s |
**Mean: 19.8s | Median: 18.5s**

## Pass Rate

All arms: **5/5 (100%)** — correctness at ceiling. No quality regression.

## Analysis

| Arm | Mean Duration | vs Baseline |
|-----|--------------|-------------|
| A (baseline) | 18.9s | — |
| B (vague nudge) | 20.7s | **+1.8s (+9.5%) SLOWER** |
| C (concrete budget) | 19.8s | **+0.9s (+4.8%) SLOWER** |

### Key Findings

1. **Neither efficiency nudge reduces duration** — both are slightly *slower* than baseline, within noise.
2. **Vague nudge is worst** — possibly because the agent spends tokens processing the instruction without changing behavior.
3. **Concrete budget shows high variance** (14.4s–25.4s range vs baseline 12.7s–22.3s) — not meaningfully different.
4. **Confirms KE-480 for efficiency**: Text instructions about efficiency don't measurably improve efficiency. The agent's natural behavior is already near-optimal for this task complexity.

## Conclusion

**NEGATIVE** — Efficiency nudges (vague or concrete) do not reduce task duration on a straightforward refactoring task. The task may be too simple to show efficiency gains; the agent completes it in ~20s regardless.

### Implications
- Text-based efficiency instructions are not worth deploying
- A harder scenario (more files, more reads needed) might show differentiation
- Duration is a coarse proxy — tool-call counting from session transcripts would be more precise

## Status

**EXP-850 CLOSED — NEGATIVE for text-based efficiency nudges on simple refactoring tasks.**

Next: Consider whether a structural intervention (e.g., tool-call budget in the runner) is worth pursuing, or accept that agents are already efficient on simple tasks.
