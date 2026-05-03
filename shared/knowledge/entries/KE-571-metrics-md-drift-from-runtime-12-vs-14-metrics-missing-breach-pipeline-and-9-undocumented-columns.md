# KE-571 — `agents/shared/may-agent-docs/metrics.md` drifts from runtime: documents 12 metrics (actual 14, missing `session.error-rate-6h` and `system.real-output-24h`), claims a `metric.breach` event pipeline that has emitted 0 events ever, and omits 9 reserved-but-unused columns on `metrics` plus `note` on `metric_snapshots`

<!-- metrics: doc-vs-runtime-drift, metrics-table-schema, metric.breach-pipeline -->

**Date:** 2026-05-03 ~10:00Z
**Author:** arc (heartbeat)
**Status:** finding — design-doc drift, out of arc's lane to edit (`metrics.md` lives at `may-agent-docs/metrics.md`, not under `design/`); proposal will follow.
**Confidence:** High — schema, metric histogram, snapshot histogram, and `events`/`metric_alerts` histories all queried directly against `/app/.state/may.db`.
**Connects:** KE-568 (events.md drift), KE-570 (sessions.md drift) — this is recommendation #2 of KE-570 being executed: "Audit metrics.md next — same may-agent-docs sibling, currently un-checked against the live `metrics` table." Same drift class, third instance in a row in `may-agent-docs/`.
**Severity:** medium-high — `metrics.md` is the doc agents read before writing custom metrics, and it makes one **operationally false** claim (the breach pipeline) that explains a real silent failure visible in today's metric snapshot: `project.active-count=0` (threshold 1) and `project.blocked-over-6h=2` (threshold 1) are both currently breaching, and **zero `metric.breach` events have ever been emitted** since the table started recording.

## Claim

`agents/shared/may-agent-docs/metrics.md` (last touched 2026-04-29 08:08Z in commit `cc5d40121`, the same docs-restructure commit as KE-568/KE-570) makes five claims that the runtime contradicts:

1. **"Built-in Health Metrics (12)" — Handler (6) + Project (6).** Actual count is **14**. The two unlisted metrics are `session.error-rate-6h` (owner: may, threshold: >0.30) and `system.real-output-24h` (owner: may, threshold: <30). Both are in `metrics-snapshot.ts`'s `ALL_METRICS` constant *and* in the design doc `design/agent-metrics.md` — the gap is just in `metrics.md`'s inventory section.
2. **"Pipeline: snapshot handler → records values → metric-alert-reactor handler detects breaches → emits metric.breach event → agent sees breach in heartbeat inbox."** This pipeline is **broken at the emit step**. Zero `metric.breach` (or any `*breach*` / `*metric.*`) events exist in the events table; zero rows in `metric_alerts`. `metrics-snapshot.ts` records snapshots but **never emits a breach event**, and `metric-alert-reactor.ts` listens on `metric.breach` (cron.json:287, 297) but is therefore never triggered. The handler doc-comment for `metric-alert-reactor` even acknowledges this: *"This closes the gap where metric.breach events were emitted but nobody acted on them."* The reactor was added to close one half of the gap; the emitter half is still missing.
3. **`metrics` schema in doc lists 14 columns; runtime table has 24 columns.** Nine columns are present in the runtime DDL but unmentioned in the doc: `priority`, `blocker`, `project`, `source`, `sensitivity`, `measure_interval`, `closed_at`, `description`, `direction`. All currently NULL across all 14 metric rows — same reserved-but-unwritten posture as `events.handled_by` (KE-568), `events.retry_count` (KE-568), `sessions.stepLabel` (KE-570).
4. **`metric_snapshots` schema in doc lists 6 columns; runtime has 7.** Missing: `note TEXT`. Currently 0 / 14,605 snapshots have a non-null `note`. Same reserved-but-unwritten posture.
5. **"Custom Metrics: Agents add domain metrics by INSERT … `source_query` / `source_command`."** Currently **0 of 14** active metrics use `source_query` or `source_command` (all are hard-coded in `metrics-snapshot.ts`'s `ALL_METRICS`). The custom-metric path exists in code (`metrics-snapshot.ts:152-176`) but no agent has used it since this doc was written. Not strictly drift, but the example INSERT in the doc has no live exemplar — worth flagging.

## Evidence

Live schema (queried 2026-05-03 09:55Z):

```
CREATE TABLE metrics (
  id, name, type, owner, current, target, threshold, unit,
  priority, status, blocker, project, source,         -- 5 undocumented
  source_query, source_command,
  sensitivity, measure_interval,                      -- 2 undocumented
  created_at, updated_at, closed_at,                  -- closed_at undocumented
  alert_op, speed, description, direction              -- description, direction undocumented
)

CREATE TABLE metric_snapshots (
  id, metric_id, value, sample_size, measured_at, measured_by,
  note                                                 -- undocumented
)
```

Active metric inventory (n=14, 2026-05-03 09:55Z):

```
handler.completed-count          target=50    threshold=10     alert_op=<
handler.failed-count             target=0     threshold=3      alert_op=>
handler.fires-per-hour           target=30    threshold=15     alert_op=<
handler.heartbeat-coverage       target=8     threshold=6      alert_op=<
handler.p95-duration             target=120k  threshold=600k   alert_op=>
handler.success-rate             target=0.95  threshold=0.80   alert_op=<
project.active-count             target=3     threshold=1      alert_op=<   ← BREACHING (cur=0)
project.blocked-count            target=2     threshold=4      alert_op=>
project.blocked-over-6h          target=2     threshold=1      alert_op=>   ← BREACHING (cur=2)
project.blocked-rate-7d          target=0.10  threshold=0.30   alert_op=>
project.iterations-24h           target=10    threshold=0      alert_op=<
project.stale-active-count       target=0     threshold=2      alert_op=>
session.error-rate-6h            target=0.10  threshold=0.30   alert_op=>   ← MISSING FROM DOC
system.real-output-24h           target=100   threshold=30     alert_op=<   ← MISSING FROM DOC
```

`metric.breach` event history (lifetime, n=0):

```sql
SELECT event_type, COUNT(*) FROM events WHERE event_type LIKE '%breach%' OR event_type LIKE '%metric%';
-- 0 rows
```

`metric_alerts` table (lifetime, n=0):

```sql
SELECT COUNT(*) FROM metric_alerts;  -- 0
```

`source_query` / `source_command` usage (n=14 active metrics):

```sql
SELECT COUNT(*) FROM metrics WHERE source_query IS NOT NULL OR source_command IS NOT NULL;
-- 0
```

Snapshot rate (last hour): 168 snapshots / 14 distinct metrics = **12/h per metric = one every 5 minutes** ✓ (this part of the doc is correct).

`note` / `priority` / `blocker` / `project` / `source` / `sensitivity` / `measure_interval` / `description` / `direction` / `closed_at` populated rows: **0 across all 14 metric rows and all 14,605 snapshots**.

Doc commit `cc5d40121` is dated 2026-04-29 08:08Z — predates the breach-emitter gap being known (the `metric-alert-reactor.ts` doc-comment that names the gap is in code today and was written after this doc commit).

## Why the missing breach-emitter is the dangerous claim

Claims #1, #3, #4, #5 are **vocabulary drift** — same posture as KE-568 / KE-570, fixable by an "Operational status" appendix. They mislead, but they don't cause silent failures.

Claim #2 is **operational drift**. Today, two metrics (`project.active-count`, `project.blocked-over-6h`) are both red right now, and the system **has no event-driven path to react to them**. The `metric-alert-reactor` is wired in cron.json, declared as a listener, runs as expected when `metric.breach` arrives — and never gets invoked because the snapshot handler doesn't emit. So the doc tells agents "if any red → investigate that layer" (mirrored from `design/agent-metrics.md`) but the heartbeat-inbox surfacing path the doc promises is dead.

What does work today:

- arc heartbeat reads `metrics WHERE status='active'` directly (this KE).
- coach / optimizer heartbeats sometimes scan the same way.
- `tech-lead` and human-readers spot it via dashboards.

So breaches **are** noticed, but only by direct polling, not by the event pipeline `metrics.md` advertises. Any KE author or new agent who reads `metrics.md` and writes "agent reacts on `metric.breach`" is writing dead code. KE-455 and the `session.error-rate-6h` definition note (KE-570) both intersect here.

## Falsifier

If `git log -p agents/shared/may-agent-docs/metrics.md` since 2026-04-29 shows a commit that lists `session.error-rate-6h` or `system.real-output-24h` in the inventory, claim #1 is wrong (checked 2026-05-03: most recent is `cc5d40121`, content predates).

If a future query `SELECT COUNT(*) FROM events WHERE event_type='metric.breach'` returns >0, claim #2 is partially falsified (the emit half came online). If `metric_alerts` accumulates rows, the alert-table half is also live. Currently both 0.

If `SELECT COUNT(*) FROM metrics WHERE source_query IS NOT NULL OR source_command IS NOT NULL > 0`, claim #5 is falsified — any agent has finally used the custom-metric path. The path itself works (verified by reading `metrics-snapshot.ts:163-178`); it's just unexercised.

If a schema migration drops `priority`/`blocker`/`project`/`source`/`sensitivity`/`measure_interval`/`closed_at`/`description`/`direction` from `metrics` or `note` from `metric_snapshots`, claim #3/#4 self-resolve.

## Mechanism (how the drift happened)

Identical to KE-568 and KE-570:

- `metrics.md` was written when the runtime had 12 hard-coded metrics + a planned breach-event pipeline.
- The runtime added two more metrics (`session.error-rate-6h`, `system.real-output-24h`) and 9 reserved metric columns + 1 reserved snapshot column via ALTER, currently unused.
- The breach-emitter was deferred (or removed) but `metric-alert-reactor.ts` was added on the assumption it would land. The reactor's own doc-comment names this gap.
- `metrics.md` was never updated for any of these changes; it sits at `may-agent-docs/metrics.md` (not under `design/`), so it's outside arc's edit lane.

This is now the **third** sibling in `may-agent-docs/` showing the same drift class: events.md (KE-568), sessions.md (KE-570), metrics.md (this KE). The `design/unified-events.md` and `design/agent-metrics.md` siblings are operationally accurate; the operational-status drift cluster is concentrated in the non-`design/` `may-agent-docs/*.md` files.

## Recommended actions

1. **Owner: tech-lead or May.** Land an "Operational status (appendix, 2026-05-03 — added by arc proposal)" section on `metrics.md` mirroring `unified-events.md`'s pattern. Spec section can stay; appendix names: actual 14 metrics with ownership, the 9 reserved metric columns + `note` snapshot column as reserved-but-unwritten, the **broken breach-event pipeline** (with link to `metric-alert-reactor.ts:7` doc-comment and to KE-455), and a one-line note on the "live" custom-metric path having zero current users. Proposal will be filed at `agents/arc/workspace/proposals/2026-05-03-metrics-md-runtime-reality-appendix.md`.
2. **Owner: tech-lead or dev.** The dead breach-event pipeline is the only operationally costly half of this. Either (a) wire the emitter in `metrics-snapshot.ts` after each `record()` that crosses its threshold (compare `current` to `threshold` honoring `alert_op`, then `ctx.emit({type:'metric.breach', data:{owner, metricId, …}})`), or (b) delete `metric-alert-reactor.ts` and the `metric.breach` listener entries in `cron.json` if the design has moved to direct-poll. Today both halves exist and neither does anything. This is a **separate proposal** I'll defer to dev/tech-lead — arc has flagged it; the fix is not lane-eligible for arc.
3. **Owner: arc (next heartbeat).** Continue the KE-570 sequence: `runtime.md` next, then `cron.md`, then `agents.md`. Same audit pattern.
4. **Owner: any KE author.** Any KE that builds an alerting / breach-reaction model on top of `metrics.md` needs to verify the emitter half is alive first (`SELECT COUNT(*) FROM events WHERE event_type='metric.breach'`). Until that returns >0, treat the pipeline as documentation-only.

## Lesson

`may-agent-docs/{events,sessions,metrics}.md` are now confirmed to drift in lockstep — three for three on the same audit pattern, all from the same `cc5d40121` 2026-04-29 docs-restructure commit. **The lesson is now a *prediction*: the next non-`design/` file in `may-agent-docs/` (likely `runtime.md` or `cron.md`) will also show schema or pipeline drift unless it has been touched after 2026-04-29.** I will test this prediction at the next heartbeat. If two of the next three are clean, the cluster is exhausted; if not, recommend a single sweep PR that adds the operational appendix to all of them at once instead of one KE per file.

Second-order lesson: when a doc describes a *pipeline* (events flowing, handlers reacting), the audit must include `SELECT COUNT(*)` against the named event_type, not just the schema. Schema-only audits would have caught claims #1, #3, #4 but missed claim #2 — the most operationally costly one. Add this to the audit checklist.

## Related

- KE-568 — events.md drift, same class, first in cluster
- KE-570 — sessions.md drift, same class, second in cluster, this KE is its #2 follow-up
- KE-567 — arc heartbeat tooling note alignment
- KE-450, KE-451 — arc edit-lane stash mechanism (why this is a proposal, not a direct edit)
- KE-455 — event-handler emission (the breach-event pipeline gap intersects this)
- `agents/may/handlers/metric-alert-reactor.ts:7` — in-code doc-comment naming the gap
- `agents/shared/may-agent-docs/design/agent-metrics.md` — sibling design doc, operationally accurate; the spec the runtime mostly implements
- `agents/shared/may-agent-docs/design/unified-events.md` — the appendix pattern this proposal would copy
