# Project: Prove the Loop

**Status**: active
**Owner**: coach
**Reviewer**: may
**Started**: 2026-04-17
**Priority**: P0 — Hao's #1 priority

## Goal
Improve coder quality metric from current 0.82 toward 0.9+ by systematically diagnosing and fixing failure modes. This proves the full loop: metrics signal → persistent task executes → gym validates → production improves.

## Current State
- `coder.quality` metric: **0.82** (7-day rolling average from evaluations)
- Target: **0.90**
- Source: `SELECT ROUND(AVG(e.quality), 2) FROM evaluations e JOIN sessions s ON e.sessionId = s.sessionId WHERE s.agent='coder' AND s.startedAt > (strftime('%s','now')*1000 - 604800000) AND e.quality IS NOT NULL AND e.skippedByJs = 0`

## Iteration Loop
Each iteration:
1. **Read** coder.quality metric (query may.db directly)
2. **Diagnose** top failure mode from recent evaluations: `SELECT e.sessionId, e.quality, e.failureModes, e.summary FROM evaluations e JOIN sessions s ON e.sessionId = s.sessionId WHERE s.agent='coder' AND e.quality < 0.8 AND s.startedAt > (strftime('%s','now')*1000 - 604800000) AND e.skippedByJs = 0 ORDER BY e.quality ASC LIMIT 10`
3. **Design** intervention (skill, context change, or workflow tweak) — ONE intervention at a time (KE-123: never stack)
4. **Test** in gym with 10 trials using `scripts/gym-batch.sh`
5. **If** pass rate improves → deploy to production (edit agent files)
6. **If** no improvement → discard and try next failure mode
7. **Loop** to next iteration

## Success Criteria
- [ ] coder.quality reaches 0.85 (milestone 1)
- [ ] coder.quality reaches 0.90 (milestone 2)
- [ ] At least 2 interventions tested in gym
- [ ] At least 1 intervention deployed to production with measured improvement

## Stop Conditions
- Quality reaches 0.90 → declare success
- 5 consecutive interventions fail in gym → stop and report (may be at ceiling)
- Out of actionable failure modes from evaluations

## Key Knowledge
- KE-123: Never stack behavioral interventions (combining 2+ degrades by 12-15pp)
- KE-133: Few-shot examples harm discovery tasks
- KE-180: Analysis gates harm performance — gate on solutions, not reports
- KE-182: Hard gate design rules for structural interventions
- KE-007: Workflow enforcement is the only reliable behavioral intervention
- Gym runner: `scripts/gym-batch.sh`
- Evaluations are in `.state/may.db` evaluations table

## Log
- 2026-04-17: Project created. coder.quality at 0.82.
