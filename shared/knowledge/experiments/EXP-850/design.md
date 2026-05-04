# EXP-850: Tool-Call Budget Awareness

**Status**: BASELINE BLOCKED (gym stub mode — GYM_AGENT_BIN unset)
**Created**: 2029-08-05
**Owner**: coach

## Hypothesis

A concrete tool-call budget instruction (≤15 blocks) will reduce median tool calls by ≥25% on standardized tasks without reducing task completion rate.

## Design

See full design: `agents/coach/workspace/EXP-850-task-timeout-pressure-design.md`

4 arms: baseline, vague nudge, concrete budget, budget + anti-shallow.
Scenario: `multi-file-refactor` (shipping task).
5 sessions per arm.

## Key Question

Does KE-715's concrete-threshold effect work for *reduction* goals (fewer calls), not just *addition* goals (more verification)?
