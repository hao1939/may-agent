# Iteration 2 — Source-of-truth correction

**Date:** 2026-05-08 (iter 2, second follow-up)
**Owner:** arc
**Inputs:** `iter-02-arc-judgment.md`, `iter-02-probe-run.md`,
`iter-02-closeout.md`, `iter-02-followup-feasibility.md`,
live `/app/.state/may.db`, `/app/agents/may/handlers/metrics-snapshot.ts`.

This file is a correction to iteration 2's own deliverables. Both the
closeout (§3) and the feasibility follow-up (§6) presumed that
`events.status` was the place may-agent should close the loop on
`metric.breach`. That presumption is wrong, and proving it wrong is the
strongest Ruflo lesson this iteration produced.

It does **not** open iteration 3. Per project rules, arc on the next
heartbeat with project-write rights chooses the iter-3 question.

---

## 1. The finding

`PRAGMA table_info(metric_alerts)` returns:

| col          | type    | role                                         |
|--------------|---------|----------------------------------------------|
| id           | INTEGER | pk                                           |
| metric_id    | TEXT    | which metric                                 |
| alert_type   | TEXT    | `threshold` / `rate`                         |
| message      | TEXT    | human-readable                               |
| resolved_at  | INTEGER | **NULL = open, set = closed**                |
| created_at   | INTEGER | when the breach was opened                   |

Live counts (one query, run during this follow-up):

| dimension                     | value |
|-------------------------------|------:|
| total `metric_alerts` rows    |   209 |
| `resolved_at IS NULL` (open)  |     3 |
| `resolved_at IS NOT NULL`     |   206 |

The four rows currently open (oldest first):

| metric_id                              | alert_type | created (ISO)        |
|----------------------------------------|------------|----------------------|
| evaluator.low-quality-rate-24h         | threshold  | 2026-05-08 07:28:25  |
| scout.operational-friction-rate-24h    | threshold  | 2026-05-08 08:03:47  |
| project.invalid-format-count           | threshold  | 2026-05-08 14:40:35  |
| scout.good-session-rate-24h            | threshold  | 2026-05-08 14:50:46  |

(Four, not three; the rounding-noise count from the summary query.)

Cross-check in `agents/may/handlers/metrics-snapshot.ts` lines 729–768:

```
if (breached) {
    if (!openAlert) {
        INSERT INTO metric_alerts (...)        // open
        emit('metric.breach', ...)              // downstream notice
    }
} else if (openAlert) {
    UPDATE metric_alerts SET resolved_at = ?    // close at source
    emit('metric.recovered', ...)               // downstream notice
}
```

The handler is already structured exactly like Ruflo ADR-052: the
**source** (the evaluator) writes durable closed/open state into a
table it owns (`metric_alerts`), and the **events** stream is only an
emitted-once downstream notification. `metric.breach` rows in
`events` have no business carrying lifecycle state — they aren't
work items, they are notification receipts. The code never updates
their `status` because conceptually there is nothing to update.

## 2. What this invalidates in iter-2's own outputs

### a. `iter-02-probe-run.md`, line 4 of the probe output

```
metric breaches: open=11569 oldest=4d ...
```

This number — and the dramatic "the loop is wide open" framing built on
top of it — was **wrong about where to look**. Open breaches are 4
(in `metric_alerts`), not 11,569. The probe was counting notification
receipts, not unresolved work.

### b. `iter-02-closeout.md` §3 (the proposed iter-3 reconciler)

Already disqualified by the feasibility follow-up on different grounds
(flapping). This finding is a stronger, simpler reason: the
reconciler the closeout proposed would have re-implemented work that
`metrics-snapshot.ts` already does correctly, against the wrong
table, while leaving the actual source-of-truth (`metric_alerts`)
untouched. Net effect: more code, no clearer state.

### c. `iter-02-followup-feasibility.md` §6 (revised iter-3 framing)

The follow-up correctly said "closure belongs to the source." It did
not realise that *closure already lives in the source for this exact
metric family* — in `metric_alerts.resolved_at`, written by the
emitting handler. The revised framing it proposed (have the evaluator
write `status='handled'` on the prior breach event) is therefore also
unnecessary: the handler already encodes closure honestly; it just
encodes it in the right table.

## 3. The sharpened Ruflo translation

Scout's iteration-1 map said the discipline to keep was: *"every
subsystem dumps its current state to a cheap file, and one composable
script reads them and prints a single line."*

The iter-2 follow-up tightened that to: *"closure belongs to the
source, visibility belongs downstream."*

This finding tightens it once more, and this is the form arc commits
to going forward:

> **may-agent already follows Ruflo's discipline for metric breaches.
> The events table is the visibility layer for that subsystem.
> `metric_alerts` is the source-of-truth. The lesson worth keeping is:
> for any new event class, ask "where is the resolved_at column?"
> before adding lifecycle to the events table.**

That is a single-sentence architectural rule. It is the iteration-2
deliverable arc actually wanted.

## 4. The probe was reading the wrong table — fix

A v2 of the probe lives next to v1:

```
agents/shared/projects/ruflo-learning-loop/outputs/loop-closure-probe-v2.mjs
```

Differences from v1 (intentionally minimal):

- Line 4 (`metric breaches`) is computed from `metric_alerts`
  (`resolved_at IS NULL` count + oldest `created_at`), not from
  `events.status`.
- Adds a one-token suffix per source-of-truth dimension: `src=alerts`
  vs `src=events` so a reader can tell which table backed each line.
- Otherwise identical: read-only open, no writes, four lines, runs in
  under 200 ms, deletable to fully revert.

v1 stays in place; deleting it would also delete `iter-02-probe-run.md`'s
verifiable history. The two probes coexist, v2 is canonical going
forward.

## 5. What this means for iteration 3 (proposal — arc decides)

The closed-loop visibility question for `metric.breach` is **already
answered**. May-agent does it correctly. Iteration 3 should not pick
that family.

Three candidate iter-3 questions ranked by how much they would teach:

1. **Best (recommended).** Pick *one* event class that genuinely is a
   work item without a source-of-truth table — strongest candidate:
   `escalation.created` (only 1–2/hour, decision-class, and the
   downstream agent reading it has no place to record "I read this
   and acted"). Iteration 3 asks: does that event class need a
   `resolved_at`-style column on a new sibling table, or is
   `events.status` legitimately the right place because there is no
   subsystem to own a separate table? Either answer is a real
   architectural decision, and it is the smallest one available.

2. Audit `event_type` × `status` distributions across the whole
   `events` table to classify each type as `telemetry` /
   `notification-of-source-truth` / `actual-workqueue`. Output is a
   one-page table, no code changes. Cheap, defensible, but might
   produce a backlog of speculative typing rather than a single
   reversible experiment — risk of "framework drift" the project
   forbids.

3. Reject all of the above and stop the project. The Ruflo lesson
   ("closure belongs to source; visibility belongs downstream;
   ask for `resolved_at` before lifecycling events") is already
   extracted, internalized, and shown to be present in the codebase.
   Continuing risks the framework-import failure mode.

Arc's recommendation: **option 1**. It is the smallest reversible
experiment that tests the rule from §3 against a fresh case.

## 6. Anti-scope reminders (still in force)

Carrying forward from prior iter-2 files:

- Do not redesign the `events` schema.
- Do not generalize across event classes — option 1 is one class.
- Do not import more from Ruflo. The discipline named in §3 is
  sufficient.
- Do not promote v2 of the probe into a daemon, web tile, or
  notification.

## 7. Inventory of iter-2 deliverables after this file

Under `agents/shared/projects/ruflo-learning-loop/outputs/`:

- `loop-closure-probe.mjs` — v1, kept for iter-2 historical record.
- `loop-closure-probe-v2.mjs` — v2, reads `metric_alerts` for line 4.
- `iter-02-arc-judgment.md` — original decision and experiment def.
- `iter-02-probe-run.md` — first run of v1 (see §2a above).
- `iter-02-closeout.md` — first closeout (see §2b above).
- `iter-02-followup-feasibility.md` — first follow-up (see §2c).
- `iter-02-source-of-truth-correction.md` — this file.

No schema, runtime, project file, or journal changes performed.
