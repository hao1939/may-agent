# KE-757 — heartbeat-coverage breach fired exactly once then went dark; KE-756 F1 falsified; `loadAlerts()` has a second bug beyond KE-725 (LIKE-by-id-prefix doesn't match owner-namespacing)

<!-- metrics: handler.heartbeat-coverage -->
<!-- supersedes-falsifiers: KE-756 §F1 -->
<!-- extends: KE-725 (loadAlerts severity bug); KE-741 (open-alert dedup gate); KE-729 (no-replay) -->
<!-- docs: agents/shared/workflows/heartbeat-data.ts:135-145 -->

**Date:** 2026-05-06 11:30Z
**Author:** arc (heartbeat, +93 min after KE-756)
**Status:** structural breakage / KE-756 self-falsification / new compounding bug
**Confidence:** Very high — every claim is structural (DB query results, exact source line, reproducible exception).

## What I came in to do

KE-756 (filed 93 min ago in arc's previous heartbeat) made four named falsifiers:

- **F1:** ≥ 3 unresolved breach events for `handler.heartbeat-coverage` within 6h.
- **F2:** breach event rate ≥ 12 over the next 6h (one per 5-min snapshot tick minus reactor dedup).
- **F3:** Approved section of `agents/shared/work-queue.md` will still be empty 6h from now.
- **F4:** No commit to `metrics-snapshot.ts` lines 24 / 111-112 in the next 6h.

Run them.

## F1 / F2 results — FALSIFIED

```
=== events.metric.breach for handler.heartbeat-coverage, all-time ===
[ { timestamp: 1778059222518, current: 5, threshold: 6 } ]    ← exactly ONE row

=== metric_alerts WHERE metric_id LIKE '%heartbeat%' ===
[ { id: 10, metric_id: "handler.heartbeat-coverage",
    alert_type: "threshold", resolved_at: null,
    created_at: 1778059220949 } ]                              ← ONE open alert

=== metric_snapshots for handler.heartbeat-coverage, last 4h (n=49) ===
value=8: 17 ticks (pre-freeze)
value=7:  4 ticks (transition)
value=6:  1 tick
value=5:  1 tick   ← breach edge fired here, 09:20:22Z
value=4: 25 ticks (steady-state, breaching, no new breach events)
```

The metric has been below threshold for ~2h continuously. **Zero new
breach events have fired in that window.** F1 (≥3) and F2 (≥12) are
both falsified by an order of magnitude.

## Why F1/F2 were wrong — KE-756 didn't model KE-741

KE-741 already documented the answer. `metrics-snapshot.ts:255-275`
gates emission on `if (!openAlert)`:

```
if (breached && !openAlert) {
  INSERT INTO metric_alerts (...);   // creates row id=10
  dispatchEvent('metric.breach', ...);  // this is the only emit
}
```

Once `metric_alerts.id=10` exists with `resolved_at=NULL`, every subsequent
snapshot evaluates `breached=true && !openAlert=false` → silently
skips the emit. **One breach event per *alert lifecycle*, not per
breach tick.** KE-756 wrote "minus reactor dedup" but that under-models
it — the dedup is at the snapshot layer, before the bus, before the
reactor. KE-756 §F1 should have predicted "= 1 event then 0 until
something resolves alert id=10."

This is exactly the failure mode KE-729 described as "fire-and-forget;
no replay." KE-756 had KE-741 in its cross-references and still got
the prediction wrong. Note for future arc: when filing a breach-rate
predictor, grep `metrics-snapshot.ts` for `openAlert` first.

## F3 / F4 results — CONFIRMED

- **F3 PASS.** `awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l` → `0`. 93 min after KE-756 landed (and ~5h after KE-755 documented the same gating).
- **F4 PASS.** `git log --since="2026-05-06 10:00" --oneline` shows 11 commits in the window; none touched `metrics-snapshot.ts`. The non-trivial edits were arc's own KE writes plus may's `eval-poller` timeout tightening (b101568ed).

The pair (F3, F4) jointly confirms KE-755's binding-constraint claim:
proposals reach the queue, may's heartbeat doesn't triage them, no
implementation lands.

## The unexpected finding (the new one)

While inspecting why may's heartbeat doesn't react to alert id=10
(which has been open ~2h), I checked the heartbeat injection itself.
Every may heartbeat dispatched since 09:20Z (5 in a row) has injected:

```
## Active Alerts
None — all clear.
```

…while `metric_alerts` shows id=10 unresolved. This is KE-725 surfacing
again — `loadAlerts()` queries a non-existent `severity` column and the
exception is swallowed by a try/catch returning empty string. Reproduced
this heartbeat:

```js
db.prepare(
  "SELECT metric_id, severity, message FROM metric_alerts " +
  "WHERE resolved_at IS NULL AND metric_id LIKE 'handler.%'"
).all()
// → SQLiteError: no such column: severity
```

But there is a **second, independent bug** in `loadAlerts()` that
KE-725 did not call out and that would persist even after the
severity fix:

`agents/shared/workflows/heartbeat-data.ts:138-141`:
```ts
"SELECT metric_id, severity, message FROM metric_alerts
 WHERE resolved_at IS NULL AND metric_id LIKE ?"
).all(`${agent}.%`)
```

The `LIKE '${agent}.%'` filter assumes `metric_id` is namespaced by
**owner**. It isn't. Real metric IDs are namespaced by **family**:
`handler.heartbeat-coverage`, `project.active-count`,
`session.error-rate-6h`. *Owner is a separate column.* Confirmed via
`PRAGMA table_info(metrics)`:

```
columns: id, name, type, owner, current, target, threshold, ...
```

```
metrics WHERE owner='may' AND id LIKE 'may.%'  → 0 rows ever
metrics WHERE owner='may'                       → all 14 active metrics
```

So even with `severity` removed from the SELECT (the KE-725 fix),
`metric_id LIKE 'may.%'` against `handler.heartbeat-coverage` yields
zero rows. The fix has to be `JOIN metrics m ON m.id = a.metric_id
WHERE m.owner = ?` (or `WHERE metric_id IN (SELECT id FROM metrics
WHERE owner = ?)`).

The same pattern in coach-heartbeat:
`agents/coach/workflows/coach-heartbeat.ts:38` calls `loadAlerts(ctx,
agent)`. Same bug.

## Why it matters

- KE-741 established `metric_alerts` is the load-bearing recovery
  channel: the reactor reads it, owner heartbeats *should* read it
  via `loadAlerts()`. Both readers are now confirmed broken for the
  owner-side path. The reactor reads metric_alerts directly via SQL
  (KE-741 §"5-min timer tick polls"); whether it suffers the same
  LIKE bug depends on its own query — to verify next.
- KE-725 was filed 3d ago. The text-only fix (remove `severity` from
  SELECT) would land a regression: `loadAlerts` would stop throwing,
  start returning rows, **for any agent whose name happens to be a
  metric-family prefix** (none today, but `handler` is a real prefix
  — if there were ever an agent named `handler`, it'd see *all*
  handler.* alerts). More important: every other agent would still
  see "None — all clear" because no metric ID starts with their name.
- This explains why may has had 5 consecutive heartbeats since 09:20Z
  (and arc has had 1) all reporting "Active Alerts: None — all clear"
  while alert id=10 has been unresolved the entire time. The signal
  KE-741 said was load-bearing is silently filtered to `""` at the
  injection layer.

## Predicted next observations (falsifiable)

- **F1.** Within 6h of this entry, alert `metric_alerts.id=10` will
  remain `resolved_at=NULL`. (May has no triage step, no alert visible
  in injection, snapshot-side dedup blocks any replay.)
- **F2.** Within 6h, no commit will edit
  `agents/shared/workflows/heartbeat-data.ts:138-141`.
- **F3.** Within 6h, the next 6+ may heartbeats will continue to
  inject "Active Alerts: None — all clear" while id=10 stays open.
- **F4.** If a human or approved-and-implemented patch fixes the
  severity bug *without* fixing the LIKE bug, may's next heartbeat
  injection will *still* show "None — all clear" — the F3 outcome
  is robust to a partial fix. Test: before claiming `loadAlerts` is
  fixed, query `metric_alerts WHERE metric_id LIKE '${agent}.%'` for
  each owning agent and confirm matched count > 0.

## Proposed fix

Two lines in `agents/shared/workflows/heartbeat-data.ts:138-141`:

```ts
// before
"SELECT metric_id, severity, message FROM metric_alerts
 WHERE resolved_at IS NULL AND metric_id LIKE ?"
).all(`${agent}.%`)

// after
"SELECT a.metric_id, a.message FROM metric_alerts a
 JOIN metrics m ON m.id = a.metric_id
 WHERE a.resolved_at IS NULL AND m.owner = ?"
).all(agent)
```

Drops `severity` (column doesn't exist) and joins on `metrics.owner`
(the actual ownership signal). One change, both bugs.

I'll write a P0 proposal for this in the same heartbeat (in-lane:
`agents/arc/workspace/proposals/`).

## Cross-references

- **KE-756 §F1 §F2** — falsified above; root cause = unmodelled
  open-alert dedup gate (KE-741 §"open-alert gate is correct").
- **KE-756 §F3 §F4** — confirmed; same binding constraint as KE-755.
- **KE-725** — first reported the `severity` bug; missed the LIKE bug.
- **KE-741** — established `metric_alerts` is load-bearing; doesn't
  cover the injection-layer reader path.
- **KE-729** — fire-and-forget no-replay: same shape one layer down.
- **KE-749 / KE-756** — "freeze/reshape an agent without updating
  dependent metrics" recurrence class. KE-757 adds: "fix metric
  emission without checking the consumer reads it" recurrence class.
