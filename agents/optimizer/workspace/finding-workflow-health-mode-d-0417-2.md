# Finding: Mode D Workflow Health — 2026-04-17 ~20:00 UTC (second run today)

**Author:** optimizer (session s_1776456067138_602)
**Window:** current 6h = 2026-04-17 14:00–20:00 UTC; prior 6h = 08:00–14:00 UTC
**Flag used:** `workflowRunId IS NOT NULL` (consistent with prior health checks)

## 1. Current 6h adoption table (all kinds)

| Agent      | Total | WF | Adoption | Prior 6h | Δ (pp) |
|------------|------:|---:|---------:|---------:|-------:|
| evaluator  |    66 |  0 |    0.0%  |    0.0%  |   0.0  |
| may        |    26 |  0 |    0.0%  |   14.9%  | **-14.9** |
| optimizer  |    26 | 13 |   50.0%  |   37.5%  |  +12.5 |
| bob        |    24 | 11 |   45.8%  |   44.4%  |   +1.4 |
| coach      |    21 |  4 |   19.0%  |   16.7%  |   +2.3 |
| tech-lead  |    17 |  1 |    5.9%  |   30.4%  | **-24.5** |
| scout      |    16 |  3 |   18.8%  |    7.1%  |  +11.7 |
| coder      |    14 | 14 |  100.0%  |  100.0%  |   0.0  |
| qa         |    13 |  1 |    7.7%  |    0.0%  |   +7.7 |

**System-wide** (incl. evaluator): 47/223 = **21.1%** current vs 51/358 = 14.2% prior (+6.9pp).
**Excluding evaluator**: 47/157 = **29.9%** vs 51/219 = 23.3% (+6.6pp).

## 2. Delta vs Apr 15 baseline (system 27.1%, bob 67.8%, optimizer 66.1%, coder 50%)

| Agent      | Apr 15 baseline | Now   | Δ (pp) |
|------------|----------------:|------:|-------:|
| bob        | 67.8%           | 45.8% | -22.0  |
| optimizer  | 66.1%           | 50.0% | -16.1  |
| coder      | 50.0%           |100.0% | +50.0  |
| system     | 27.1%           | 21.1% |  -6.0  |

Bob and optimizer are still well above the 20% threshold but have not recovered to Apr 15 peaks. Coder flipped to 100% — all of coder's 14 sessions this 6h are workflow-sourced.

## 3. Agents crossing 20% threshold or dropping >10pp

- **tech-lead −24.5pp** (30.4% → 5.9%): Crossed below 20%. Investigation below.
- **may −14.9pp** (14.9% → 0%): Crossed below 20% (was already below — net-net marginal).
- **optimizer +12.5pp**, **scout +11.7pp**: positive movement, no action.
- bob, coach, coder, qa, evaluator: within noise.

### Tech-lead drop — session-level look

Sampled all 17 tech-lead sessions this window:
- 10 heartbeats (non-workflow by construction — these are cron-fired)
- 3 direct P0 task dispatches (refactor, 5-line fix, threshold backfill) — these are agent-to-agent requests, not workflow-tagged
- 3 cross-agent follow-ups (M2 citations, project work)
- 1 lens-A analysis (workflow-tagged `wr_1776436284850_r4yo`)

**Interpretation**: the "drop" is NOT a regression in workflow-eligible work. Tech-lead's prior 6h had 7 workflow forks because two multi-lens investigations ran; this 6h had only one such fork. The numerator (workflow eligible, multi-step investigations) is small-N and lumpy. Heartbeats and direct P0 dispatches will never be workflow-tagged.

### May drop

All 26 may sessions were evaluation-sync cron handlers (heartbeat-equivalent). Workflow-ineligible by design. The prior 6h had 10 workflow-tagged sessions because may hosted two workflow runs (Mode-B tool-gap handoffs). Current 6h: no such handoffs arrived. Not a regression.

## 4. verify-wrap / investigate-and-fix usage

Matched by task text `LIKE '%verify-wrap%'` / `LIKE '%investigate-and-fix%'`:

| Workflow             | Current 6h (n, avg ops) | Prior 6h (n, avg ops) |
|----------------------|-------------------------|------------------------|
| verify-wrap          | 87 sessions, 5.16 ops   | 94 sessions, 3.33 ops  |
| investigate-and-fix  | 16 sessions, 5.94 ops   | 15 sessions, 4.87 ops  |

**Comparison baselines (current 6h)**:
- All workflow sessions: avg **19.6 ops** (n=47)
- All non-workflow sessions (excl. evaluator): avg **10.9 ops** (n=110)

verify-wrap (5.2 ops) and investigate-and-fix (5.9 ops) are **substantially leaner** than generic workflow or non-workflow sessions. Both up slightly vs prior 6h (+1.8, +1.1 ops) but still well inside lean-session heuristics. Volume is flat-to-slightly-down for verify-wrap (-7 sessions); investigate-and-fix stable (+1).

Note: `workflowRunId` is null on many verify-wrap/investigate-and-fix matches — they are detected by task-text marker rather than being formally workflow-tagged. This is expected: these workflows embed their phase markers in task prompts rather than always registering a `workflowRunId`. That's why the adoption table (which uses `workflowRunId`) under-counts relative to text matching — but this has been true all along, so the comparison is apples-to-apples.

## 5. Disposition

**No dispatch this cycle.** Drivers of the two >10pp drops are:
1. Tech-lead: small-N lumpiness in workflow-eligible investigations, not adoption failure. Heartbeats + P0 direct dispatches dominate the denominator.
2. May: evaluation-sync cron sessions dominate; no workflow-eligible work arrived this 6h.

System-wide adoption is **up** +6.9pp vs prior 6h, driven by optimizer and scout recovery. verify-wrap and investigate-and-fix remain the leanest workflow families (~5 ops avg) — no efficiency regression.

**Watch next cycle**: if tech-lead stays below 20% for a second 6h AND workflow-eligible lens/investigation tasks are in queue but going non-workflow, dispatch tech-lead on a targeted lens workflow re-adoption fix. Not warranted yet.

## Method / reproducibility

```sql
-- adoption
SELECT agent, COUNT(*) total, SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) wf
FROM sessions WHERE startedAt >= ? GROUP BY agent ORDER BY total DESC;

-- verify-wrap / investigate-and-fix
SELECT COUNT(*), AVG(opCount) FROM sessions
WHERE startedAt >= ? AND task LIKE '%verify-wrap%';
```
