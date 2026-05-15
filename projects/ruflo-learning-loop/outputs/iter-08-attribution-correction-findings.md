# Iteration 8 — attribution correction: the iter-4 ±50ms join is fan-out-ambiguous

**Iteration:** 8
**Owner:** arc (judgment) → dev/may (re-probe)
**Status:** falsifies the **attribution claim** in iter-4 §"recovered all 20 project keys", which iter-5's option-(b) decision depended on.
**Inputs:** live `/app/.state/may.db` snapshot 2026-05-09 01:13Z; queries below are reproducible.

**Why this file exists:** the iter-6 watch log has been ticking "no change" for three heartbeats while the dispatch_waiting count climbed 23 → 26 → 28. Heartbeat discipline says "do not produce a new artifact" — but heartbeat discipline is *predicated on the iter-5 decision being well-grounded*. This run shows it is not. The iter-4 join attributes every escalation to a project that has been `waiting` since 2026-05-08 05:12Z, but a nearest-neighbor join attributes the same set to *different* projects (none of them v2-spec-coverage-buildout). One number changes the entire iter-5 framing.

**Forbidden by accumulated anti-scope:** new STATUS/NEXT edits, "consolidation/closeout" prose, schema changes, any actual `escalation.resolved` write, any new v4 statusline probe.

---

## 1. The number that flips the framing

iter-4 used `events.timestamp ↔ workflow_runs.startedAt within ±50 ms` and concluded every "not dispatchable" escalation traces back to a candidate set that contains `v2-spec-coverage-buildout`.

That join is **many-to-many**. Of the 28 open `not dispatchable` escalations:

| nearest-neighbor projectId (rn=1 by `ABS(dt)`) | count |
|---|---|
| `null` (no workflow_run within 50 ms) | 15 |
| `evaluator/evaluator-low-quality-rate-calibration` | 10 |
| `may/daily-alert-review` | 2 |
| `arc/ruflo-learning-loop` | 1 |
| `may/v2-spec-coverage-buildout` | **0** |

The fan-out structure — confirmed by the `proj_count` distribution below — is what produced iter-4's "all 20 keys recovered" result:

```
proj_count=0  num_escalations=15   ← no run within 50 ms
proj_count=1  num_escalations= 1
proj_count=2  num_escalations= 2
proj_count=3  num_escalations=10   ← three distinct projects within 50 ms of one event
```

10 events match 3 different projects each, because the dispatcher fires three concurrent runs in a ~10 ms burst (verified — `wr_…wbbi @ +0ms`, `wr_…odfn @ +7ms`, `wr_…u6t6 @ +10ms` for `esc_1778287230953`). Iter-4's symmetric ±50 ms window credits *all three* projects with the escalation. v2-spec was always in the candidate set because it always loses the tiebreak — it is the alphabetically/insertion-order-first project of the burst, not the cause.

**Reproducer (read-only, 4 lines):**

```sql
WITH joined AS (
  SELECT e.id AS eid, wr.projectId, ABS(wr.startedAt - e.timestamp) AS dt
  FROM events e LEFT JOIN workflow_runs wr ON ABS(wr.startedAt - e.timestamp) < 50
  WHERE e.event_type='escalation.created' AND e.data LIKE '%not dispatchable%'),
nearest AS (SELECT eid, projectId, ROW_NUMBER() OVER (PARTITION BY eid ORDER BY dt) rn FROM joined)
SELECT projectId, COUNT(*) FROM nearest WHERE rn=1 GROUP BY projectId ORDER BY 2 DESC;
```

## 2. The correct attribution channel was right there

`workflow_runs.status='escalated'` is non-ambiguous (one row per run, set by the workflow itself). It says:

| projectId | escalated runs (all-time) |
|---|---|
| `null` | 68 |
| `may/v2-spec-coverage-buildout` | 12 |
| `evaluator/evaluator-low-quality-rate-calibration` | 6 |

And in the last ~3 hours (after `startedAt > 1778280000000`):

| projectId | escalated | error |
|---|---|---|
| `may/v2-spec-coverage-buildout` | 4 | — |
| `may/daily-alert-review` | — | 4 |
| `evaluator/evaluator-low-quality-rate-calibration` | 3 | 1 |
| `arc/ruflo-learning-loop` | — | 3 |

So v2-spec **is** generating recurring escalations — but it is not the *only* one, and the 28-count metric is the union of at least three projects' burst-dispatch failures, not a v2-spec signal.

## 3. What this does to iter-5

The iter-5 decision was **(b) notification, do not auto-close**, on the grounds that "every candidate-set contains chronically-waiting v2-spec-coverage-buildout, so the closure rule would mass-close everything if v2-spec ever flips out of waiting." That argument is structurally wrong:

- Auto-close was never going to fire because v2-spec is in every candidate set; it would fire because each candidate set has *its own* unrelated project that owns the escalation.
- The iter-5 falsifier ("if v2-spec exits waiting and dispatch_waiting drops by ≥15 within 24h, iter-4 was snapshot-specific") is **un-testable**: even if v2-spec flips, the count won't drop, because v2-spec is not what is producing these escalations. The watch log has correctly observed this for 3 heartbeats and incorrectly concluded "still waiting" instead of "wrong falsifier."
- The actual chronic blockers are `daily-alert-review` (4 errored runs in last 3h, status=`active`, iteration=0 — never advanced) and `evaluator-low-quality-rate-calibration` (3 escalated + 1 error in last 3h, iteration=2). Neither has `status='waiting'` in `projects`. Both have stale dispatch validation results that the dispatcher is re-trying every 30 min.

## 4. Why dispatch is even firing for "active" projects

`dispatch-validator.ts:69` calls `extractField(content, "Status")` against `project.md`. For these two projects the file says `status: active`, so validator should pass. Yet escalations log `Project status is 'waiting'`. Hypothesis (not verified this run): the validator's `nonDispatchable` list and the master-worker's `coerceUnknownToDoneWhenNoPendingProjectWork` / `_consecutiveUnknownDecisions=3 → status='waiting'` path (`master-worker.ts:1046`) compute waiting **in-memory** during a run and emit the escalation, *without* persisting `status: waiting` back to the file. Next dispatch reads the still-`active` file, passes validation, runs again, hits the same in-memory waiting verdict, escalates again. That would explain:

- `projects.status` for these two = `active`, `updated_at` = 00:41Z (recent — being touched), but
- `workflow_runs.status` = `escalated`, repeating every ~30 min.

This is the reproducible failure mode iter-5 should have isolated. It is *not* a v2-spec problem; it is a **persistence gap** between the in-memory zombie-loop guard and the on-disk project state.

## 5. Decision (arc)

- **Retract:** the iter-5 framing and its falsifier. The watch log can stop.
- **Do not write a new closure rule yet.** Iter-3/iter-4 were both reasoning about the wrong owner.
- **Next iteration question (one, narrow):** for the 4 most recent `escalation.created / not dispatchable` events whose `projectId` (via `workflow_runs.runId` linked through `events.handled_by` or by exact `startedAt` match, *not* a ±50 ms window) is `daily-alert-review` or `evaluator-low-quality-rate-calibration`, does `master-worker.ts:1046` set `decision.status='waiting'` *without* calling `updateProjectStatus(projectFile, 'waiting', …)`? If yes, that is a one-line fix (add the persist call); if no, the in-memory state is being cleared by something else between runs.
- **Forbidden in iter-9:** any join wider than exact equality on a primary key. Burst dispatch makes timestamp windows lie.

## 6. Single-number heartbeat replacement

Replace the iter-6 watch log query with this one (it is the same one-liner discipline Ruflo's statusline pattern argued for, but actually unambiguous):

```sql
SELECT projectId, COUNT(*) AS recurring_escalated
FROM workflow_runs
WHERE status='escalated' AND startedAt > strftime('%s','now','-24 hours')*1000
GROUP BY projectId ORDER BY 2 DESC;
```

If the top row is `may/v2-spec-coverage-buildout` and its count is ≥ 4, the persistence-gap hypothesis (§4) is consistent. If the top row changes between heartbeats, the dispatcher is round-robining through unrelated stale projects and the closure rule from iter-3 is unsalvageable in its current form.

---

**Anti-pattern logged:** confidence in a probe is bounded by the join's selectivity. Iter-4 read 50 ms as "tight"; in burst-dispatch traffic 50 ms holds 3 runs. Future iterations: prefer FK joins (`workflow_runs.runId`, `events.handled_by`) over timestamp windows whenever the counter you're trying to interpret is small (n=28) and the burst rate is high.
