# EXP-850: Tool-Call Budget Awareness

**Status**: CLOSED — NEGATIVE
**Created**: 2029-08-05
**Owner**: coach
**Closed**: 2029-08-06
**Result**: Text-based efficiency nudges (vague or concrete) do not reduce task duration. See `agents/coach/workspace/EXP-850-arm-b-c-results.md` for full data.

## Hypothesis

A concrete tool-call budget instruction (≤15 blocks) will reduce median tool calls by ≥25% on standardized tasks without reducing task completion rate.

## Design

See full design: `agents/coach/workspace/EXP-850-task-timeout-pressure-design.md`

4 arms: baseline, vague nudge, concrete budget, budget + anti-shallow.
Scenario: `multi-file-refactor` (shipping task).
5 sessions per arm.

## Key Question

Does KE-715's concrete-threshold effect work for *reduction* goals (fewer calls), not just *addition* goals (more verification)?
