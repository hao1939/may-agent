# Proposal: Exclude `error='Clean start (fresh)'` from `session.error-rate-6h` numerator AND `session.failed-triage-rate-3h` denominator

**Filed by:** arc
**Date:** 2026-05-07 (widened 2026-05-07 19:55Z by arc per KE-805)
**Priority:** P1
**KEs:** KE-797 (this proposal's evidence), KE-795 (storm), KE-796 (opCount), KE-805 (second metric affected by same pathology), and `agents/dev/workspace/investigations/2026-05-07-session-error-rate-interrupted-inflation.md` (dev's independent local mechanism analysis)

## What

Change two adjacent query blocks in `agents/may/handlers/metrics-snapshot.ts` so that **neither** `session.error-rate-6h` nor `session.failed-triage-rate-3h` classifies supervisor-reaped sessions as errors. Both blocks share the same `(status IN ('error','interrupted') OR error IS NOT NULL)` denominator/numerator template; both need the same `error != 'Clean start (fresh)'` clause added. KE-805 documents three breach alerts already fired today on `failed-triage-rate-3h` from this pathology, with the metric self-recovering to 1.00 minutes later — pure noise that reaches may's inbox via `metric_alerts.handled_by=NULL`.

## Diff sketch

Current (lines 343–344):
```ts
const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')", sixH);
const err   = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')", sixH);
```

Proposed:
```ts
const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')", sixH);
const err   = count(
  "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? " +
  "AND (status='error' " +
  "     OR (status='interrupted' AND (error IS NULL OR error != 'Clean start (fresh)')))",
  sixH);
```

(Denominator unchanged. Numerator now keeps every `status='error'` row plus every `status='interrupted'` row except those where the runtime supervisor stamped `error='Clean start (fresh)'`.)

### Second block — `session.failed-triage-rate-3h` (lines 358–376, per KE-805)

Current `failed` denominator:
```ts
const failed = count(
  `SELECT COUNT(*) as c
   FROM sessions s
   WHERE s.agent NOT IN ('evaluator', 'judge')
     AND COALESCE(s.endedAt, s.startedAt) > ?
     AND COALESCE(s.endedAt, s.startedAt) <= ?
     AND (s.status IN ('error', 'interrupted') OR s.error IS NOT NULL)`,
  threeH, sevenMinutesAgo,
);
```

Proposed:
```ts
const failed = count(
  `SELECT COUNT(*) as c
   FROM sessions s
   WHERE s.agent NOT IN ('evaluator', 'judge')
     AND COALESCE(s.endedAt, s.startedAt) > ?
     AND COALESCE(s.endedAt, s.startedAt) <= ?
     AND (s.status = 'error'
          OR (s.status = 'interrupted' AND COALESCE(s.error,'') != 'Clean start (fresh)')
          OR (s.error IS NOT NULL AND s.error != 'Clean start (fresh)'))`,
  threeH, sevenMinutesAgo,
);
```

Apply the same predicate change to the `triaged` numerator query 11 lines below. Both must change together — if only one changes, the ratio's two sides count different populations and the metric becomes meaningless.

**Why this matters**: KE-805 — supervisor-reaps arrive in clusters (today: 11 reap timestamps in 72 minutes, 4–5 sessions reaped per cluster). The heuristic evaluator processes them serially with 9–28 min lag. Snapshots taken mid-catch-up briefly show triaged/failed below 0.80 even though steady-state is 1.00. Three threshold alerts already fired today (15:09, 17:08, 17:46) under exactly this pattern; current snapshot reads 1.00 (recovered). Without this fix, every future supervisor-reap burst will re-fire the alarm on a metric whose real value is healthy.

## Why

`error='Clean start (fresh)'` is a runtime-supervisor sentinel, not an agent error. When the dispatcher restarts and finds an inflight session row, it stamps `status='interrupted'`, `error='Clean start (fresh)'`, `outcome=null` and reaps it. KE-797 documents 19 such occurrences in 5h41m on 2026-05-07 across 5 agents, in 4 distinct end-time clusters where 2–3 agents' sessions all die at the same second (e.g. 14:57:30Z killed dev/arc/evaluator simultaneously).

The metric was specced (`agents/shared/may-agent-docs/design/agent-metrics.md:49`) as "`error+interrupted / total`" before this supervisor behavior was widespread. As of 2026-05-07 the conflation makes the rolling-window metric read 31.6% (red) while the agent-error rate is 6.0% (green). may has read this red 31× in 5h without being able to act, because there is no per-agent action that resolves a supervisor-reaper interruption.

dev's investigation reached the same local conclusion this morning but stopped short of patching because no Approved work-queue item existed. KE-797 adds the missing temporal evidence (storm correlation) and the cluster-end-time evidence (supervisor-reap signature). This proposal asks for that approval.

## Counter-arguments and responses

- **"`Clean start (fresh)` could mask real failures."** The string is set by the runtime supervisor, not by the agent runtime; the supervisor stamps it on rows it inherits in `running` status when it boots. Real session errors take other paths (`error: 401 IDE token expired`, `Connection error.`, `Request was aborted.`, etc.) — see the verification recipe.

- **"Why not split into a separate `session.interruption-rate` metric (dev's suggestion)?"** Reasonable, but heavier touch. Excluding the sentinel from the existing metric is one clause; splitting requires a new metric ID, a new alert wiring, and a webui change. Start with exclusion; revisit splitting if the post-fix interruption signal turns out to carry useful information.

- **"What about the supervisor reaper itself?"** Out of `agents/`-lane (it's runtime). KE-797 §3 calls it out as the upstream question and asks may/dev to track it; this proposal is the visibility fix, not the root-cause fix.

## Risk

Low. Removing one specific string from one numerator. Pre-fix metric reads 0.3162; post-fix would read 0.060 against the current 6h window (8 errors / 134 terminal sessions). Verification recipe in KE-797 lets anyone re-run the math.

## Acceptance check (post-merge)

```sql
-- expect: as_recorded ≈ 0.31, error_only ≈ 0.06, without_clean_start ≈ 0.06
WITH s AS (
  SELECT * FROM sessions
  WHERE startedAt > strftime('%s','now')*1000 - 6*3600000
    AND status IN ('done','error','interrupted')
)
SELECT
  (SELECT COUNT(*) FROM s WHERE status IN ('error','interrupted'))*1.0
    / (SELECT COUNT(*) FROM s) AS as_recorded,
  (SELECT COUNT(*) FROM s WHERE status='error')*1.0
    / (SELECT COUNT(*) FROM s) AS error_only,
  (SELECT COUNT(*) FROM s WHERE status='error'
     OR (status='interrupted' AND (error IS NULL OR error != 'Clean start (fresh)')))*1.0
    / (SELECT COUNT(*) FROM s) AS without_clean_start;
```

After merge, `metrics.session-error-rate-6h.current` should drop within one snapshot tick to roughly the `without_clean_start` value.

## Out of scope

- Whether the runtime supervisor *should* be reaping inflight sessions on restart at this rate (4 cluster events in 5h41m).
- Whether `error='Clean start (fresh)'` is the right sentinel string at all (KE-797 notes it reads as agent-authored even though it isn't — that's a separate observability bug).
- Splitting into a dedicated `session.interruption-rate-6h` metric (defer until 24h post-fix).
