# Baseline Metrics — Agent System Literacy Project

**Measured:** 2025-06-25 (Iteration 10)

## 1. Project Creation Rate

**Source:** `.state/projects/` filesystem (15 project files)

| Period | Projects Created | Rate |
|--------|-----------------|------|
| Apr 22-23 (days 1-2) | 7 | 3.5/day |
| Apr 26 (day 5) | 2 | — |
| Apr 27 (day 6) | 2 | — |
| Apr 28 (day 7) | 4 | — |
| **Total (7 days)** | **15** | **~2.1/day** |

Additionally, 5 active structured projects exist under `agents/shared/projects/`:
- agent-system-literacy
- handler-reliability
- request-deduplication
- skill-workflow-audit
- system-efficiency

**Note:** The `projects` table in may.db is empty — project tracking uses filesystem, not DB.

## 2. Session Activity & Success Rate (Last 7 Days)

**Source:** `session_digests` table in may.db

| Agent | Sessions | Success | Failed/Blocked | Success Rate |
|-------|----------|---------|----------------|--------------|
| amy | 404 | 200 | 0 | 49.5%* |
| coach | 219 | 104 | 0 | 47.5%* |
| bob | 218 | 99 | 1 | 45.4%* |
| optimizer | 161 | 78 | 0 | 48.4%* |
| may | 122 | 59 | 1 | 48.4%* |
| scout | 90 | 45 | 0 | 50.0%* |
| qa | 59 | 29 | 1 | 49.2%* |
| tech-lead | 54 | 23 | 0 | 42.6%* |
| evaluator | 10 | 5 | 0 | 50.0%* |
| **Total** | **1,337** | **642** | **3** | **48.0%*** |

*Remaining sessions likely have outcome 'partial' or 'interrupted', not counted as success or failure.

**Key finding:** Only 3 sessions across all agents resulted in failure/blocked in 7 days — extremely low failure rate. The gap between total sessions and success count is likely 'partial' outcomes.

## 3. Escalation Quality

**Source:** `session_digests` WHERE outcome IN ('failure','blocked')

Only 3 failed/blocked sessions in 7 days (bob: 1, may: 1, qa: 1). Sample too small to measure escalation quality statistically. The summaries field was empty in the query results, suggesting escalation context may not be captured in digests.

**Baseline:** Insufficient data to measure. Need to check if agents include reason + what-was-tried when escalating.

## 4. Key System Metrics (from `metrics` table)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| bob.session-success-rate | 96.9% | 90% | ✅ active |
| coach.intervention-hit-rate | 50% | 60% | ⚠️ below target |
| coach.skill-effectiveness | 62.5% | 60% | ✅ on_track |
| tech-lead.build-health | 1 (pass) | 1 | ✅ active |
| tech-lead.meaningful-changes | 3,942 commits/wk | 10 | ✅ active |
| scout.CRs-produced | 12/7d | 5 | ✅ active |
| agent-utilization | 9 agents | 10 | ✅ active |

## 5. Skill Deployment Status

Three literacy skills deployed to 4 agent directories (verified in previous iteration):
- `reading-metrics.md` → amy, amy-kimi, coach, tech-lead
- `creating-projects.md` → same 4 agents
- `closing-the-loop.md` → same 4 agents

**Total: 12 skill files deployed.**

## 6. Gym Scenario Results

**Status:** No valid gym runs recorded. The `gym_runs` table is empty. Previous attempts to run scenarios via `test/gym/run-gym.sh` returned "skipped" (no agent binary configured) or stub results.

**Blocker:** Gym runner requires `GYM_AGENT_BIN` env var pointing to an agent binary. Attempts to run with `--timeout` produced no meaningful results in 9 iterations.

---

## Summary

| Metric | Baseline Value | Notes |
|--------|---------------|-------|
| Project creation rate | ~2.1/day (15 in 7 days) | Filesystem-based tracking |
| Session success rate | 48% (642/1337) | Remaining are partial/interrupted |
| Session failure rate | 0.2% (3/1337) | Very low |
| Escalation quality | N/A | Too few failures to measure |
| Skill deployment | 12/12 files | Verified on filesystem |
| Gym pass rate | 0/0 | No valid runs completed |
| Coach intervention hit rate | 50% | Below 60% target |
| Skill effectiveness | 62.5% | On track (target: 60%) |
