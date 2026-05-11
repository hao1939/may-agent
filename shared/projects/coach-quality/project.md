---
id: coach-quality
owner: coach
status: closed
type: milestone
priority: P1
workflow: project
iteration: 50
stop_reason: COMPLETE — target met (avg 0.70 vs ≥0.50 target). Hit iteration cap 50 but goal was achieved at iter ~19.
---

# Project: Coach Work-Session Quality


## Goal
Raise coach JS quality score from 0.24 (worst in system) to ≥0.50. Root cause: open-ended work sessions fail hard while structured heartbeats/cron are near-perfect.

## Metric
- JS quality score (evaluator) for coach work sessions
- Baseline: 0.24
- Target: ≥ 0.50

## Current State (updated iter-4, COMPLETE)
- **TARGET MET**: Last 8 evaluator quality scores for coach: 0.50, 0.62, 0.78, 0.58, 0.72, 0.75, 0.90, 0.75. Average: 0.70. All ≥0.50.
- Evidence source: `agents/evaluator/workspace/activity.jsonl` — grep for coach "done" events with quality scores.
- Baseline was 0.24, driven by shallow crash sessions + poor execution. Interventions (OUTPUT FORMAT + EXECUTION RULES in heartbeat.md) raised behavioral quality decisively.
- **Project complete.** No further action needed unless regression detected.

## Plan

### Milestones
- [x] M1: Diagnose — identify top 3 failure patterns in coach work sessions (interrupted, inconclusive, over-budget)
- [x] M2: Design work-session scaffold template (read task → plan 3 steps → execute → verify → finish with evidence)
- [x] M3: Deploy scaffold into coach's context/skills
- [x] M4: Measure — audit recent coach work sessions for scaffold compliance and quality
- [x] M5: Activate — inject scaffold reminder into coach context.md preamble (not just skill reference) with exact first-3-lines template the agent MUST output
- [ ] M6: Enforce — add `scaffold_phases_completed` field to coach's finish() and checkpoint() calls so compliance is observable
- [x] M7: Re-measure — after 48h, re-audit compliance rate. Target: ≥60% Phase 0+1 compliance → RESULT: 0% compliance, loophole identified
- [x] M8: Rewrite scaffold trigger — remove "not for heartbeats" exemption, replace with: "Apply when you'll make >3 tool calls toward an objective, regardless of session type (heartbeat, work, cron)"
- [x] M9: Gym test — run 2-3 gym scenarios as coach agent to verify scaffold compliance in controlled setting → RESULT: 0% compliance, context.md text is ignored
- [ ] M10: Re-measure after M8+M9 — SKIPPED, pivot to enforcement
- [x] M11: Workflow enforcement — 2-phase heartbeat deployed: Phase 1 forces plan (no tools), Phase 2 executes plan
- [x] M12: Gym re-test — RESULT: gym infra can't test workflows; verified architecturally instead
- [x] M13: Monitor first real enforced heartbeat — RESULT: workflow .ts file is dead code, never fires. Heartbeat uses heartbeat.md as prompt directly.
- [x] M14: Inject mandatory output format into `agents/coach/heartbeat.md` — add "OUTPUT FORMAT (MANDATORY)" section at top requiring GOAL/PLAN/DONE WHEN before any tool calls
- [x] M15: Wait for next natural heartbeat — RESULT: ✅ Compliance confirmed. Coach heartbeat output GOAL/PLAN/DONE WHEN before tool calls.
- [x] M16: Measure JS quality score post-enforcement — RESULT: 0.448 (up from 0.24, below 0.50 target)

### Re-plan trigger
After M16: score 0.448 < 0.50 → diagnose Phase 2 execution quality.

### New Milestones (iter-15)
- [x] M17: Diagnose score gap — RESULT: Score dragged down by pre-enforcement data. Skipped formal report.
- [x] M18: Improve execution quality — RESULT: EXECUTION RULES deployed in heartbeat.md (verify writes, no drift, require evidence).
- [x] M19: Re-measure after 24h — RESULT: ✅ Last 8 evals average 0.70 quality, all ≥0.50. Target met.

### Re-plan trigger
Project complete. Monitor for regression in future evaluator runs.
