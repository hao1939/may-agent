# EXP-271: Manual Capability Attribution on Agent Failures

**Hypothesis**: H-CAP1 — Decomposing agent failures into capability dimensions (memory, planning, perception, tool-use) produces consistent, actionable attributions that pass/fail cannot.
**Status**: DESIGNED
**Date**: 2026-08-29
**Source**: DD#906 (arXiv:2604.25161), design doc `agents/bob/workspace/designs/capability-oracles-evaluator.md`

## Problem

Our evaluator reports pass/fail. When failures happen we don't know which capability broke. This blocks targeted improvement — we can't fix what we can't diagnose.

## Method

1. **Sample**: Take 10 recent gym failures from `agents/gym/results.jsonl` (EXP-164 baseline arm has 8 failures with "discount behavior fail")
2. **Attribution rubric**: For each failure, attribute to one or more of:
   - **Memory**: Agent forgot or failed to retrieve relevant context
   - **Planning**: Agent chose wrong strategy or wrong step order
   - **Perception**: Agent misread code, errors, or file contents
   - **Tool-use**: Agent used wrong tool or wrong tool sequence
3. **Process**: Read session logs for each failure. Apply rubric. Record primary and secondary attribution.
4. **Consistency check**: Second pass with different framing. Measure self-agreement.

## Success Criteria

| Outcome | Action |
|---------|--------|
| ≥80% agreement on primary attribution | H-CAP1 SUPPORTED — proceed to automate oracles |
| 50-80% agreement | PARTIAL — refine rubric, re-test |
| <50% agreement | H-CAP1 REFUTED — capability boundaries too fuzzy to be useful |

## Data Source

EXP-164 baseline arm (D-baseline): 8 failures, all same pattern (product passes, behavior checks fail on discount logic). These may all be the same capability failure — which is itself informative.

## Next Steps After Completion

If supported → Design automated capability oracles as evaluator plugins.

## Connection to Other Work

- **DD#906**: Source paper — capability-oriented failure attribution
- **EXP-230**: "Read raw data" resistance = planning failure under this framework
- **EXP-270**: Structured taint tokens = addressing handoff after attribution
- **EXP-248**: Belief-state externalization = one specific capability (perception/planning) intervention
