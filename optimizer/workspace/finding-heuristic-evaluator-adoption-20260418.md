# Finding — Heuristic evaluator adoption 0.49 (target 0.70)

**Session:** s_1776490291649_881 · **Date:** 2026-04-18 · **Metric:** `optimizer.tool-adoption`
**Severity:** P1 — metric below threshold **because the tool is silently broken**, not because agents aren't using it.

## TL;DR

- **R1 = FIX-READY (done in this session).** The heuristic evaluator (`agents/may/handlers/evaluation-sync.ts`) was deleted 13h ago in a scout workspace-cleanup commit (`608709124`). The cron entry kept firing and failing with ENOENT; `may` disabled the cron (`5e14f4e48`, IT-27 follow-up) without restoring the handler, and `coder` re-enabled it but did not restore the file (`193bbba2b`).
- Net effect: since 2026-04-17 16:04Z, **zero new heuristic rows have been written** to `evaluations`. Every new eval is LLM, dragging the 7d adoption ratio down as the heuristic backlog ages out.
- Restoring the handler from `608709124^:may/handlers/evaluation-sync.ts` (439 lines, pure JS, no LLM cost) returns adoption to its prior trajectory (~0.55-0.60 at current volume; target 0.70 reachable once the full 7d window re-fills).
- No intervention on "force more sessions through heuristic path" is needed — **the data-collection lever is broken, not the routing lever**. Restoring the handler is one change (KE-123 compliant).

## Evidence

### 1. Metric is real and below threshold

From `agents/optimizer/workspace/metrics-definitions.md` and commit `b15b39b7a`:
- `optimizer.tool-adoption` = `SUM(evaluatedByHeuristic) / COUNT(*)` over `evaluations`, last 7d. Target 0.70, threshold 0.50, alert direction `below`.
- Current snapshot: **0.492** (n=7095 rows over 7d).

### 2. Heuristic rows stopped writing 13h ago

`bun:sqlite` query against `.state/may.db` (hour bucket, last 24h):

```
hr                 heur=0 skip=0 (LLM)   heur=0 skip=1 (skipped)   heur=1 skip=0 (heuristic)
2026-04-18 05      2                     0                          0
2026-04-18 04      7                     0                          0
2026-04-18 03      6                     0                          0
2026-04-18 02      8                     0                          0
2026-04-18 01      7                     0                          0
2026-04-18 00      9                     0                          0
2026-04-17 23      6                     0                          0
2026-04-17 22      7                     0                          0
…
2026-04-17 16      9                     1                          4      ← last heuristic batch
2026-04-17 15      14                    15                         16
2026-04-17 14      14                    32                         17
2026-04-17 13      38                    31                         24
```

The last `evaluatedByHeuristic=1` row timestamp is in the `16:00` bucket on 2026-04-17, matching the commit time of `608709124` (2026-04-17 16:04Z). **Since then, every new eval is a child-session LLM eval via `evaluateTask()` or `evaluateStandaloneSession()`.**

### 3. Only one code path sets `evaluatedByHeuristic=1`

`grep -rn "evaluatedByHeuristic: true" src/ agents/` →  only `agents/may/workspace/audits/bulk-eval.ts` (a manual audit script, not a cron) and, by reference, the deleted `agents/may/handlers/evaluation-sync.ts`. Every production write path for heuristic rows was the `evaluation-sync` handler.

### 4. Deletion + re-enable history (why the cron ended up enabled but broken)

From `cd agents && git log --oneline -p -- may/cron.json may/handlers/evaluation-sync.ts`:

| Commit | Date (UTC) | What | Effect |
|---|---|---|---|
| `c463a40d1` | 2026-04-17 11:06Z | may: last fix to evaluation-sync.ts (writes skip rows for evaluator sessions) | handler present, cron enabled |
| `608709124` | 2026-04-17 16:04Z | scout session 806: todo.md hygiene sweep | **deletes `may/handlers/evaluation-sync.ts` (439 lines)** — unrelated to the stated commit scope |
| `f29e2a37d` | 2026-04-18 00:57Z | tech-lead: IT-27 diagnosis (ENOENT root cause) | diagnosis only |
| `5e14f4e48` | 2026-04-18 00:59Z | may: disable stale evaluation-sync cron (IT-27) | `enabled: false` — stops ENOENT noise but **loses heuristic coverage** |
| `193bbba2b` | 2026-04-18 01:34Z | coder: session artifacts after auto-pause test assertion fix | **re-enables the cron** (`enabled: true`) with original description — handler file still missing |

The last commit (re-enable without restore) is almost certainly accidental — `coder`'s stated scope was "auto-pause test assertion fix". Net result: since 2026-04-18 01:34Z the cron is firing again, fails at ENOENT on every tick, and writes 0 rows. There are **78 FAILED `cron:evaluation-sync` requests in the last 24h** (`SELECT COUNT(*) FROM requests WHERE task LIKE '%cron:evaluation-sync%' AND status='FAILED' AND createdAt > now-24h` → 78).

### 5. Restore is trivial and low-risk

- Source of truth: `git show 608709124^:may/handlers/evaluation-sync.ts` retrieves the exact 439-line file that was working up to 2026-04-17 16Z.
- No schema changes since deletion — `evaluations` table columns unchanged; `skippedByJs` semantics unchanged.
- Handler is pure JS (bun:sqlite + fs reads), no LLM cost.
- Import test: `bun -e "import('./agents/may/handlers/evaluation-sync.ts')"` → loads, exports `create: function`. ✅

## Expected impact

- **Before**: 0.492 adoption over 7d; trending downward as the 7d window drops pre-deletion heuristic rows.
- **After restore**: heuristic writes resume at ~3-5 rows per 10-min tick (based on pre-deletion rate: ~16-24/hr in the 13:00-15:00 buckets on 04-17). Over 24h that's roughly 400-600 new heuristic rows; over 7d, several thousand — enough to push the 7d ratio back toward the pre-deletion equilibrium (0.55-0.60 range, visible from the same table before the gap). Hitting target 0.70 may require additional coverage expansion later, but that's a second-order question — the first-order fix is stopping the bleed.
- **Quality-preserved guard**: AVG(quality) for optimizer's heuristic-scored sessions is 0.890 (threshold 0.85). Restoring the existing, previously-working handler cannot move this — same code, same scoring rubric. ✅ no risk to the 0.9 quality floor.
- **Cost**: zero LLM cost added. Also saves 78 FAILED requests / 24h = ~3.3/hr of infra noise in `requests` table.

## Why not "expand heuristic routing"?

The Phase-1 script asked about extending heuristic coverage by moving conditions out of the LLM path. I did look (breakdown of LLM-evaluated rows by agent, last 7d):

| agent | LLM-evaluated count (heur=0, skip=0) |
|---|---|
| optimizer | 199 |
| bob | 179 |
| tech-lead | 163 |
| coach | 108 |
| coder | 103 |
| may | 73 |
| scout | 34 |
| qa | 32 |
| evaluator | 19 |

These are all from `evaluateTask`/`evaluateStandaloneSession` (real LLM work — parent/child trees and the evaluator-heartbeat sampler). Moving any of those to heuristic path would **degrade quality** (the 0/0 group has avg quality 0.714 — it's capturing the harder-to-score long sessions). That's exactly the wrong lever to pull given the 0.89 quality floor. The 0.49 adoption number is a **measurement artifact of the broken pipeline**, not a real routing problem — proven by hourly time-series above.

## Recommendations

### R1 — RESTORE the deleted handler  — **DONE THIS SESSION**

- **File**: `agents/may/handlers/evaluation-sync.ts`
- **Change**: restore from `git show 608709124^:may/handlers/evaluation-sync.ts` (439 lines, verbatim).
- **Why R1**: single-point fix, reversible, zero risk to quality-preserved metric, directly moves the metric. KE-123 compliant (one change only).
- **Expected impact**: adoption 0.49 → 0.55–0.60 within 24h, 0.60–0.70 over 7d as the window re-fills. ENOENT noise in `requests` drops to 0.
- **Verification**: after next cron tick (10min), `SELECT COUNT(*) FROM evaluations WHERE evaluatedByHeuristic=1 AND createdAt > ?` should show new rows; `SELECT COUNT(*) FROM requests WHERE task LIKE '%cron:evaluation-sync%' AND status='FAILED' AND createdAt > now-1h` should be 0.

### R2 — Don't act now: coach follow-up on cross-agent file deletion

`608709124` ("scout todo.md hygiene sweep") deleted an active cron handler in a different agent's dir. This already has a coach-side note in the IT-27 tech-lead diagnosis (§6). No code change here — just a note to coach that scout's workspace-cleanup commits shouldn't ever touch `may/handlers/`. Low priority, not this session's scope.

### R3 — Don't act now: evaluate whether to merge heuristic+sampler into one config

The `evaluator-heartbeat.ts` handler already owns LLM-upgrade sampling. Long-term there's a case for co-locating both the heuristic writer and the LLM-upgrade sampler under one handler so deletion of one can't silently break the other. But this is a refactor, not a fix — not today.

## Files changed this session

- `agents/may/handlers/evaluation-sync.ts` — restored (439 lines) from `608709124^`.
- `agents/optimizer/workspace/finding-heuristic-evaluator-adoption-20260418.md` — this file.

## Commit

See commit SHA at end of session (appended after `git commit`).
