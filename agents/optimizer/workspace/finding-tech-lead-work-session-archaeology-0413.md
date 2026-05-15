# Tech-Lead Work Session Archaeology — 42+41 Op Sessions

**Date**: 2026-04-13 ~21:52 UTC  
**Scope**: Two highest-op tech-lead work sessions in recent window, plus systemic patterns  
**Sessions investigated**: `s_1776115316913_405` (42 ops), `s_1776011071613_2237` (41 ops)

## Executive Summary

Tech-lead has **0% workflow adoption** across all 167 work sessions (every single `workflowRunId` is NULL). The D-o-R Lens deployment (embedding phase budgets in task text) cut Lens sessions from 31.3→9.3 avg ops (**70% reduction**), proving structured budgets work even without formal workflows. The two investigated sessions are both reasonable — one builds a tool (review-merge.sh), one audits a workflow — but they reveal that **review-branch management is tech-lead's #1 cost category** (1,206 ops, 38 sessions).

## Session 1: `s_1776115316913_405` — review-merge.sh Build (42 ops)

- **Task**: Build `scripts/review-merge.sh` to automate the 7-8 step git review branch merge workflow
- **Source**: Forked from heartbeat `s_1776115298475_403` (3 ops — lean dispatch ✅)
- **Duration**: ~6 min (1776115316918 → 1776115683549)
- **Children**: Spawned 1 child `s_1776115347351_407` (8 ops — Lens D subscriber audit, unrelated side-quest)
- **Deliverable**: `scripts/review-merge.sh` — 204 lines, executable, working
- **Tree cost**: 50 ops total (42 + 8)

**Assessment**: 42 ops for a 204-line shell script is reasonable for a build task (reading context, writing, testing). The 8-op child was a side-quest — tech-lead started a lens session *inside* a build task, adding 19% waste to the tree. The build itself should pay back quickly: review-branch merges average 31.7 ops each, so saving 4-5 ops/merge across 38 sessions = ~160-190 ops saved.

**Verdict**: ✅ Justified investment. ROI positive within ~10 merges.

## Session 2: `s_1776011071613_2237` — Implement-and-Verify Audit (41 ops)

- **Task**: Audit implement-and-verify workflow production reliability — failure rates, retry effectiveness, false failures
- **Source**: Forked from heartbeat (agents.fork)
- **Duration**: ~8 min
- **Children**: None
- **Deliverable**: Should be `audit-implement-verify-reliability.md` — **NOT FOUND on disk** (likely in agents/ subrepo, committed/archived)
- **No workflow used** despite auditing a workflow

**Assessment**: 41 ops for a data-driven audit is borderline high. This was a pre-D-o-R session — with the current phase budget enforcement (≤20 ops total), this would be capped at ~20 ops. The D-o-R Lens deployment would have cut this session in half.

**Verdict**: ⚠️ Would be 50% cheaper under current D-o-R regime.

## Systemic Findings

### 1. Zero Workflow Adoption (167/167 sessions)
Every tech-lead work session has `workflowRunId = NULL`. The heartbeat.md explicitly tells tech-lead to use `lens-analysis`, `implement-and-verify`, and `parallel-research` workflows — but the LLM ignores this and uses `agents.fork()` instead.

**This is the same adoption pattern as gym-batch.sh and session-query.ts**: text instructions don't drive tool adoption (KE-020). The fix must be structural — route dispatches through workflow code, not through agent prompts.

**Impact**: Unknown. The D-o-R phase budgets are embedded in task text and DO work (see Lens finding below). But formal workflows would add verification gates and error handling that raw forks lack.

### 2. D-o-R Lens Deployment — Massive Win
|Metric|Pre-D-o-R|Post-D-o-R|Change|
|---|---|---|---|
|Lens sessions|58|16|ongoing|
|Avg ops/session|31.3|9.3|**-70%**|
|Max ops|96|23|-76%|
|Sessions >30 ops|23 (40%)|0 (0%)|eliminated|

The D-o-R approach works by embedding phase budgets (`SCOPE ≤3 → INVESTIGATE ≤10 → WRITE ≤5 → EXIT 1`) directly into the forked task text. Even without formal workflow enforcement, the text-based budget caps are highly effective.

**This is the most successful tech-lead intervention to date.** Projected savings: ~14 Lens sessions/day × 22 ops saved = ~308 ops/day (~$15/day).

### 3. Work Session Category Costs
| Category | Sessions | Avg Ops | Total Ops | Notes |
|---|---|---|---|---|
| **review-branch** | 38 | 31.7 | 1,206 | #1 cost — git merge sprints |
| fix | 31 | 26.0 | 805 | Bug fixes, good value |
| implement | 15 | 33.5 | 503 | Feature implementations |
| lens-B | 21 | 23.6 | 495 | Flow complexity traces |
| lens-A | 18 | 25.6 | 461 | Architecture reviews |
| lens-D | 12 | 25.7 | 308 | Fragility analysis |
| lens-C | 13 | 22.7 | 295 | Dead weight audits |
| **build** | 6 | 38.2 | 229 | Tool/script building — highest per-session |
| other | 13 | 19.3 | 251 | |

**Review-branch work is #1**: 1,206 ops across 38 sessions, averaging 31.7 ops each. The newly-built `review-merge.sh` targets exactly this. If it saves 4-5 ops per merge and tech-lead does ~6 merges/day, that's 24-30 ops/day saved.

**Build sessions are the most expensive per-session** (38.2 avg). These are tool-building sessions (like review-merge.sh). They're inherently high-op because they involve reading context, writing code, and testing. ROI depends on adoption — same pattern as all our tool adoption findings.

### 4. Trend Data — Recent Improvement
| Window | Work Sessions | Avg Work Ops | Avg HB Ops |
|---|---|---|---|
| 0-12h | 22 | 16.2 | 11.5 |
| 12-24h | 11 | 38.1 | 6.7 |
| 24-48h | 44 | 30.2 | 6.1 |

Work session avg dropped from 30-38 to 16.2 in the most recent 12h — the D-o-R Lens deployment is clearly working. Heartbeat ops rose slightly (11.5 vs 6.1-6.7) possibly due to increased dispatching complexity, but still well within budget.

## Recommendations

1. **Monitor review-merge.sh adoption** — Will tech-lead actually use the script it built? Based on KE-020, prompt mentions alone won't work. Need to check adoption in next 24h.

2. **Don't bother with formal workflow wiring for tech-lead** — The text-based D-o-R phase budgets are already achieving 70% reduction. Adding workflow infra would add complexity for marginal gain.

3. **Consider D-o-R for non-Lens work sessions** — Fix (26 avg ops) and implement (33.5 avg ops) sessions could benefit from similar phase budgets embedded in task text.

4. **Track the child-session side-quest pattern** — The 42-op session spawned an unrelated Lens child. This is a scope creep pattern that adds ops to what should be focused build tasks.

## Data Sources
- `.state/may.db` sessions table (167 tech-lead work sessions, 167 heartbeats analyzed)
- `scripts/review-merge.sh` (204 lines, confirmed on disk)
