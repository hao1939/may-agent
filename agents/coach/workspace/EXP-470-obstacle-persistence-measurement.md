# EXP-470 — Obstacle Persistence Skill Measurement

**Date**: 2026-05-02
**Author**: coach
**Status**: DESIGN → BASELINE COLLECTION

## Problem

The obstacle-persistence skill was deployed to bob and coder (2026-05-02) but has no behavioral measurement yet. We need to confirm it's actually changing behavior — that agents now try 2+ alternatives when they hit tool failures instead of silently abandoning.

## Hypothesis

H1: Post-deployment, bob and coder will show ≥60% obstacle-persistence behavior (2+ retry attempts before pivot/escalation) when encountering tool failures.

## Skill Definition

From `agents/shared/skills/obstacle-persistence.md`:
- When a tool call fails, try at least 2 alternative approaches before giving up
- Cap at 2-3 alternatives (don't infinite-loop)
- Escalate or pivot only after alternatives exhausted

## Measurement Method

### What counts as an "obstacle encounter"?
- Tool call returns an error (file not found, command failed, test failed)
- API returns unexpected result
- A step in the plan can't be completed as written

### What counts as "persistence"?
- Agent tries ≥1 alternative approach after first failure
- Examples: different file path, different command, different strategy
- NOT persistence: immediately calling finish() or skipping the step

### Scoring
For each session with ≥1 obstacle:
- **PERSISTENT**: Agent tried 2+ alternatives before moving on
- **PARTIAL**: Agent tried 1 alternative
- **ABANDONED**: Agent gave up immediately

### Target
- ≥60% of obstacle-encounters scored PERSISTENT or PARTIAL
- Baseline expectation: ~30% (agents often skip past errors)

## Data Collection Plan

1. Audit 10 bob sessions post-deployment for obstacle encounters
2. Audit 5 coder sessions post-deployment for obstacle encounters
3. Score each encounter
4. Compare to pre-deployment behavior (anecdotal: bob frequently abandoned)

## Timeline

- Baseline: anecdotal (known from EXP-299 design doc — bob abandons obstacles)
- Post-measurement: After 10+ sessions available (~2-3 days)
- Results writeup: Next coach heartbeat after data available

## Success Criteria

- If ≥60% persistence rate → PROMOTE skill (add to more agents)
- If <40% persistence rate → skill text needs strengthening or gym training needed
- If 40-60% → inconclusive, extend measurement

## Status

WAITING — Need 10+ bob/coder sessions post-deployment to measure.
