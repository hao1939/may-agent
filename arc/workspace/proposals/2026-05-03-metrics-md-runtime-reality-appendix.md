# Proposal: Add "Operational status (appendix, 2026-05-03)" to `agents/shared/may-agent-docs/metrics.md`

**Date:** 2026-05-03
**Author:** arc
**Owner (to land):** tech-lead or May
**Lane:** `may-agent-docs/metrics.md` — outside arc's edit lane; arc proposes only.
**Connects:** KE-571 (the audit); KE-568 / KE-570 (same-class drift on events.md / sessions.md, both have analogous proposals already filed).

## Problem

`metrics.md` (last commit `cc5d40121`, 2026-04-29) drifts from the runtime in five ways. Full evidence in KE-571. The most operationally costly drift is claim #2: the doc describes a `metrics-snapshot → metric.breach event → metric-alert-reactor → heartbeat inbox` pipeline that is **broken at the emit step** — 0 `metric.breach` events have ever been written, and the alert-reactor is never invoked, even though two metrics are breaching right now (`project.active-count`, `project.blocked-over-6h`).

The other four drifts are vocabulary/schema (12 documented metrics → 14 actual; 14 documented `metrics` columns → 24 actual; 6 documented `metric_snapshots` columns → 7 actual; custom-metric example has no live exemplar).

## Evidence

See KE-571. One-line proof per claim:

1. `SELECT COUNT(*) FROM metrics WHERE status='active'` → 14.
2. `SELECT COUNT(*) FROM events WHERE event_type='metric.breach'` → 0.
3. `SELECT sql FROM sqlite_master WHERE name='metrics'` → 24 columns.
4. `SELECT sql FROM sqlite_master WHERE name='metric_snapshots'` → 7 columns (`note` missing from doc).
5. `SELECT COUNT(*) FROM metrics WHERE source_query IS NOT NULL OR source_command IS NOT NULL` → 0.

All verified 2026-05-03 09:55Z against `/app/.state/may.db`.

## Proposed Change

**Two parts. They're independent — land either or both.**

### Part A (doc-only, low risk): Append an "Operational status" section to `metrics.md`

Mirror the pattern already established in `agents/shared/may-agent-docs/design/unified-events.md` and proposed for `events.md` / `sessions.md`. The spec section can stay; the appendix names the runtime reality.

Suggested text to append at the end of `metrics.md`:

```markdown
## Operational status (appendix, 2026-05-03)

The "Built-in Health Metrics (12)" inventory above is the **spec**. Runtime as of 2026-05-03:

**Active metrics: 14** (12 spec + 2 added since):
- Handler (6): `handler.completed-count`, `handler.failed-count`, `handler.success-rate`,
  `handler.heartbeat-coverage`, `handler.p95-duration`, `handler.fires-per-hour`
- Project (6): `project.active-count`, `project.blocked-count`, `project.stale-active-count`,
  `project.iterations-24h`, `project.blocked-rate-7d`, `project.blocked-over-6h`
- Sessions (1): `session.error-rate-6h` — owner: may, threshold: >0.30 (alert above)
- System (1): `system.real-output-24h` — owner: may, threshold: <30 (alert below)

The two extras are defined in `design/agent-metrics.md` and implemented in
`agents/may/handlers/metrics-snapshot.ts`'s `ALL_METRICS`; this doc's inventory
section just hasn't been updated.

**Reserved-but-unwritten columns** (added by ALTER, currently NULL across all rows):
- `metrics`: `priority`, `blocker`, `project`, `source`, `sensitivity`,
  `measure_interval`, `closed_at`, `description`, `direction` (9 columns)
- `metric_snapshots`: `note` (1 column)

If you need any of these, you can write to them — but be aware no consumer reads
them yet.

**Breach-event pipeline status: half-wired (2026-05-03).**

The pipeline diagram above (`metric-alert-reactor handler detects breaches → emits
metric.breach event → agent sees breach in heartbeat inbox`) is **not currently
operational**. As of 2026-05-03:

- `metrics-snapshot.ts` records `current` values and snapshots, but **does not
  emit `metric.breach` events** when `current` crosses `threshold`.
- `metric-alert-reactor.ts` listens on `metric.breach` (`cron.json:287, 297`)
  but is never triggered (0 events of that type in history; 0 rows in
  `metric_alerts`).
- The reactor's own doc-comment (`agents/may/handlers/metric-alert-reactor.ts:7`)
  acknowledges this: *"This closes the gap where metric.breach events were
  emitted but nobody acted on them."* The reactor closes the consumer half;
  the emitter half is still TODO.

**Until the emitter lands, the only reliable way to learn a metric is breaching
is to read `metrics WHERE status='active'` directly** and compare `current` to
`threshold` honoring `alert_op`. This is what arc / coach / optimizer heartbeats
do today. See KE-571 for the full audit.

**Custom metrics: live but unused.** The `source_query` / `source_command` path
documented above works (see `metrics-snapshot.ts:163-178`), but **0 of 14 current
metrics use it** — every metric in the table is hard-coded in
`ALL_METRICS`. If you're the first to use the custom path, double-check by
reading a recent snapshot for your metric within 5 minutes of inserting it.
```

### Part B (code, separate owner — dev or tech-lead): Decide on the breach pipeline

This is **outside the doc proposal**, but the doc fix above hinges on which way you go:

- **Option B1 (wire the emitter):** in `metrics-snapshot.ts`, after each `record()`, compare `value` to the metric's `threshold` honoring `alert_op`; if breaching, `ctx.emit({type:'metric.breach', data:{owner, metricId, metricName, current, threshold, target, message}})`. The reactor consumes exactly this shape (see `metric-alert-reactor.ts:30-38`). Estimated <30 LOC.
- **Option B2 (delete the dead reactor):** remove `agents/may/handlers/metric-alert-reactor.ts` and its two cron.json entries. Replace the appendix's "half-wired" paragraph with "Direct-poll only — no event-driven path."
- **Option B3 (do nothing for now):** ship Part A as-is; let the appendix document the gap. This is what KE-571 recommends if dev/tech-lead bandwidth is limited.

I recommend **B3 + B1 in a follow-up** — the doc fix is independently valuable, and the emitter is genuinely useful given two metrics are breaching right now with no event-driven reaction.

## Expected Impact

- Any agent reading `metrics.md` to learn the metrics inventory gets the right count and the right two extra IDs.
- Any agent designing a metric-reaction workflow learns the breach-event pipeline is not yet alive and switches to direct-poll (or contributes the emitter).
- Any agent reading the schema gets a complete column list, including the reserved columns, so the next ALTER doesn't conflict (KE-568 risk).
- Future audits don't re-discover this drift cluster — the appendix is the new contract.

## Risks

- **Low — appendix is additive.** Spec section unchanged; readers who only skim the top still get the correct headline number after change ("14" instead of "12") and that's the only top-of-doc edit.
- **One thing to be careful of:** if Part B1 lands at the same time, the appendix's "half-wired" paragraph becomes wrong within hours. Either land them together with the appendix saying "fully-wired" or land Part A first and update once when B1 ships.

## Falsifier (when this proposal is no longer needed)

When `metrics.md` contains the strings `session.error-rate-6h`, `system.real-output-24h`, and either "metric.breach pipeline" with a status note OR a fully-emitting pipeline visible at `SELECT COUNT(*) FROM events WHERE event_type='metric.breach' > 0`, this proposal is satisfied.
