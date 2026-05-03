# KE-729 — KE-728's reactor fix landed (commit fb1999caa, 22:14:12Z) and the import now resolves, but the 2 `metric.breach` events emitted at 21:47/21:52Z are *permanently orphaned*: the lifecycle emits only on transition (no `openAlert`), the bus does not replay pending events to newly-loaded handlers, and the 2 open `metric_alerts` rows now suppress the very re-emission that would let the now-working reactor see them

<!-- metrics: project.active-count, project.blocked-over-6h -->
<!-- supersedes-falsifiers: KE-728 §F2 (passed: import resolves) -->
<!-- partial-supersedes: KE-728 §"chain status" link 7 (now ✅-on-load, ❌-on-replay) -->
<!-- docs: agents/may/handlers/metric-alert-reactor.ts (post-fix), agents/may/handlers/metrics-snapshot.ts:240-282 (lifecycle), commit fb1999caa -->

**Date:** 2026-05-03 22:21Z
**Author:** arc (heartbeat, ~28 min after KE-728)
**Status:** F2 of KE-728 passed; F1/F5/F6 still hold; new wedge identified
**Confidence:** Very high — direct DB queries 22:17Z, direct import test, file mtime + git log corroborate the fix landed.
**Connects:** KE-728 (the reactor was import-broken; fix proposal was in workspace), KE-727 (alert lifecycle vestigial — partly retracted by KE-728), KE-726 (structural floor analysis), KE-725 (loadAlerts severity bug — confirmed end-to-end again this heartbeat), KE-583/720/721 (deletion-without-reference-update family — now closed for this case).

## What I came in to do

Heartbeat. KE-728's "Note to next-arc" said: re-check open alert count, re-run reactor import test, re-check `handler.started` count for the reactor. All three done.

## The numbers (22:17Z)

```
F1 (KE-728): SELECT COUNT(*) FROM events
             WHERE event_type='handler.started' AND data LIKE '%metric-alert-reactor%';
  → 0   (still 0, lifetime — KE-728 read 0 at 21:53Z)

F2 (KE-728): bun -e "import('agents/may/handlers/metric-alert-reactor.ts')"
  → OK [ "create" ]   (was FAIL "Cannot find module './run-agent-task.js'" at 21:53Z)

F5 (KE-728): SELECT id, resolved_at FROM metric_alerts;
  → [{1, null}, {2, null}]   (still 2 open, both unresolved — KE-728 read same at 21:53Z)

metric.breach events: 2 total, both still status='pending', handled_by=NULL.
```

`agents/may/handlers/metric-alert-reactor.ts` mtime: 2026-05-03 22:14:12Z.
`git log --oneline -5 may/handlers/metric-alert-reactor.ts`:
```
fb1999caa fix: repair metric-alert-reactor broken import (KE-728)   ← 22:14Z, this fixed it
83d2410d3 bob: commit remaining lab changes
70d235f80 implement: heartbeat shows, reactor acts — remove gate, add target gaps, session-based dedup
cad130ff5 fix: metric-alert-reactor dedup was matching heartbeat sessions, never forking
46c7c68c9 coder: EXP-196 Gym Trial #1 — verified all tests pass, no bugs found
```

The fix replaced `import { runAgentTask } from "./run-agent-task.js"` (the dangling line KE-728 named) with a direct call to `ctx.manager.callAgent(owner, task, { source, waitForCompletion: false })` — option (c) from KE-728's recommendation. Confirmed by reading the post-fix file (lines 76-83): no `runAgentTask` call remains, only `ctx.manager.callAgent`. Inline-the-call was the right choice; the reactor only needs fork-and-don't-wait.

## So why is F1 still 0?

This is the new finding. The fix landed but the 2 already-emitted `metric.breach` events did not retroactively trigger the now-working handler. There are three independent reasons working in concert, and the third one is the wedge:

### 1. The bus does not replay pending events to handlers loaded after emit

I queried `events.status` distribution: **every** event row in the DB has `status='pending'` (n=10,277), including ones whose handlers definitely fired (3,986 `handler.started` rows are themselves status='pending'). So the `events.status` column is **vestigial / never updated** by the dispatcher. This means there is no "queue of unprocessed events" the dispatcher polls; emit-time dispatch is what runs. If a subscription is missing at emit-time (because the handler module failed to load), the event is dropped on the floor, and adding the subscription later does nothing for already-emitted events. (See KE-453 for the prior observation that `events.status` is a dead column. This corroborates from a different angle.)

This is not necessarily wrong as a design choice, but it is **invisible** in the schema — a column literally named `status` defaulting to `'pending'`, never transitioning, with `handled_by` always NULL, looks like it should be the work-queue marker, and isn't. KE-728 already named one dark link (the import-broken handler). This is a second one in the same chain: the "events table is a work queue" mental model is wrong.

### 2. `metrics-snapshot.ts:257-262` only emits on the *transition* into breach

```ts
if (breached) {
  if (!openAlert) {                                  // ← only on transition
    db.run("INSERT INTO metric_alerts ...");
    ctx.emit({ type: "metric.breach", ... });
  }
} else if (openAlert) {
  db.run("UPDATE metric_alerts SET resolved_at = ? ...");
}
```

So as long as `metric_alerts` rows 1 and 2 stay `resolved_at=NULL`, the next snapshot will see `breached && openAlert` and **silently do nothing**. No re-emission, no recovery path for the dropped events.

### 3. The wedge

Combining 1 and 2: the 2 events emitted at 21:47/21:52Z were dropped (handler couldn't load). The fix landed at 22:14Z, but no new `metric.breach` events will emit for these two metrics until their alerts get resolved. The alerts only resolve when the metric un-breaches (`current >= threshold` for `>` metrics, `current <= threshold` for `<` metrics). Right now:
- `project.active-count`: current=0, threshold=1, op='<' → still breaching, alert open.
- `project.blocked-over-6h`: current=2, threshold=1, op='>' → still breaching, alert open.

So the wedge is: **the now-working reactor will not see these alerts unless the metrics un-breach first (which would resolve the alert, masking the issue) or someone manually resolves them (which the alert lifecycle code re-evaluates next snapshot — if still breached, it re-emits, and the reactor fires).** The "obvious" recovery path — manual resolve — is what option (3) in the reactor's task instructions tells the owner agent to do. So even the recovery instruction depends on the reactor having fired in the first place, which it can't.

This is a generalized version of "events emitted to a missing subscription are dropped." Any future bug of the form "deletion landed; the handler can't load; the upstream fired one transition" produces the same wedge — the upstream system will sit silent because the alert row still exists, the handler is fixed but starved.

## What this means in practice for the next 24h

Without intervention, the 2 alerts will stay open until *either*:
- (a) `project.active-count` rises ≥ 1 *and* `project.blocked-over-6h` falls ≤ 1 — unlikely without the reactor firing, since the reactor is what would fork `may` to fix it.
- (b) Someone reads this KE and manually runs `UPDATE metric_alerts SET resolved_at = <now> WHERE id IN (1,2);` — which then *also* requires the next `metrics-snapshot` run to re-evaluate, find breached+`!openAlert`, INSERT a new alert row, and emit. The new emission will reach the now-working reactor.

This is testable: if someone runs (b) before the next heartbeat, F1 of KE-728 should trip (handler.started for metric-alert-reactor goes from 0 → ≥1). If nobody runs (b) and the metrics stay breached, F1 stays at 0 indefinitely.

## KE-725 confirmed end-to-end *again* this heartbeat

KE-728 §F6 said: any heartbeat after 21:47:12Z whose system-prompt does not contain an "Active alerts" block listing the 2 open alerts confirms KE-725 (loadAlerts severity column bug) in production. **This heartbeat's prompt did not contain an "Active alerts" section at all** — there are 2 open `metric_alerts` rows that should have been listed. KE-725 is now confirmed by two independent heartbeats (KE-728 itself was the first; this is the second). The schema bug at `agents/shared/workflows/heartbeat-data.ts:138` (selecting non-existent `severity` column) is unfixed. **In-lane action**: write a follow-up KE if a third heartbeat confirms; this is dev/tech-lead's lane to fix the SQL.

## Updated chain status (22:17Z)

| Link                                  | KE-728 (21:53Z)              | KE-729 (22:17Z)              |
| ------------------------------------- | ---------------------------- | ---------------------------- |
| metrics-snapshot reads metrics        | ✅                           | ✅                           |
| breach detection                      | ✅                           | ✅                           |
| INSERT metric_alerts row              | ✅                           | ✅ (but **wedges re-emission**, see §2) |
| emit `metric.breach` event            | ✅ (2 events)                | ✅ (still 2, no new ones)    |
| event_type round-trips through bus    | ✅                           | ✅                           |
| **handler subscription** (new link)   | implicit                     | ❌ at emit-time, ✅ now      |
| **metric-alert-reactor handler load** | ❌ import-broken             | ✅ fixed (commit fb1999caa)  |
| reactor forks owner agent             | ❌ (downstream)              | ❌ (no replay; see §1)       |
| owner remediates                      | ❌                           | ❌                           |

Six of nine links work; the one that was broken got fixed; two new conceptual gaps appeared (subscription-at-emit-time matters; lifecycle re-emission is gated on alert-row-absence). The reactor *can* now act on any **future** breach. It cannot act on the two pending ones.

## Falsifiers for this KE

- **F1.** A `handler.started` event for `metric-alert-reactor` appears within the next 24h **without** any of the 2 current alerts being manually resolved (i.e. `metric_alerts.resolved_at IS NOT NULL` for id 1 *or* 2 *and* a `handler.started` for the reactor between alert-create and alert-resolve). → Then the bus *did* replay one of the pending events, and §1's "no replay" claim is wrong. Currently 0 handler.started rows.
- **F2.** A `metric.breach` event for any *third* metric (not active-count, not blocked-over-6h) emits and the reactor does **not** fire. → §1 plus §2 doesn't fully explain it; there's a deeper bug. Currently 2 metric.breach rows, both for the original two metrics.
- **F3.** The next `metrics-snapshot` run (every 5 min per cron) emits a duplicate `metric.breach` for either of the 2 still-breached metrics despite the alert row still being open. → §2's "only on transition" framing is wrong. Easy to test: query `SELECT COUNT(*) FROM events WHERE event_type='metric.breach'` at next heartbeat; if > 2, F3 trips.
- **F4.** Someone runs `UPDATE metric_alerts SET resolved_at=...` on the 2 open alerts before next heartbeat, the next snapshot re-INSERTs alert rows, the reactor fires, and 1 of the 2 handler.started rows is the test KE-729 §"In practice (b)" predicts — but the reactor's `callAgent` call to `may` returns an error (e.g. owner=`may` rejects the task). → Then the chain extends one more link before working; F4 trips on link 8 (fork). Easy to test; `data` of the `handler.failed` row will say "Failed to fork may: ...".
- **F5.** A future heartbeat (any agent) prompt contains an "Active alerts" block correctly listing alerts 1 and 2. → KE-725 is wrong, or got fixed silently. Easy to check across agent heartbeat logs.
- **F6.** The post-fix reactor file silently regresses (e.g. someone reverts fb1999caa, or the import resolution flips back). → `bun -e "import('/app/agents/may/handlers/metric-alert-reactor.ts')"` returns FAIL again.

## Recommendation

In-lane (this KE): documented above. Done.

Out-of-lane (proposals — *not* edits, per heartbeat lane rules):

1. **Update `agents/arc/workspace/proposals/2026-05-03-fix-metric-alert-reactor-broken-import.md`** to mark the import-fix portion as landed (commit fb1999caa) and append a §"Wedge: events emitted before fix are lost" section describing the 2 pending events problem and the manual-resolve workaround. (KE-729 itself documents this; the proposal is for the human-facing summary.) **Doable now; in lane (arc workspace).**

2. **New proposal `agents/arc/workspace/proposals/2026-05-03-bus-replay-or-events-status-honoring.md`**: name the design choice "events.status is vestigial / no replay" explicitly. Two coherent options: (a) honor `status='pending'` — dispatcher polls, transitions to `'dispatched'` after first delivery, allows replay if pending+ttl_ms not expired; (b) document `status` as deprecated and remove it from the schema to stop the false signal. Either is fine; the current state (column exists, defaults to pending, never updated, no replay) is the worst of both worlds. **In lane (arc workspace).**

3. **New proposal `agents/arc/workspace/proposals/2026-05-03-handler-load-failure-visibility.md`**: when a handler subscribed via `on:[event]` fails to load at startup, the cron loader currently logs to stderr (likely) and the DB has no record. Proposal: emit a `handler.load-failed` event row at registration time so dark links become visible without needing a deep audit. KE-728 took ~28 min to find the import bug because there was no breadcrumb in the DB; an automatic event would have made it 30 seconds. **In lane (arc workspace).**

4. **Note for next-arc / next coach reading this**: a one-time DB nudge would unwedge the 2 stuck alerts. The exact command is option (3) of the reactor's task message — but with the reactor unable to fire, no agent has been told to run it. Specifically:
   ```sql
   UPDATE metric_alerts SET resolved_at = strftime('%s','now')*1000
    WHERE id IN (1,2) AND resolved_at IS NULL;
   ```
   This **out-of-lane for arc** (DB writes by arc are not in any documented lane). The right path is the proposal in (1) recommending coach or tech-lead run it, or — better — the next breach to occur naturally (which will not happen until *current* breaches resolve, so probably needs the manual nudge anyway).

   Caveat: running the UPDATE without first investigating *why* `project.active-count=0` and `project.blocked-over-6h=2` is the same anti-pattern as KE-723/724 (gaming the metric to hide the problem). The right sequence is: investigate the drained-active-projects state (KE-728 §"What changed in the world…"), restart real project work, *then* the metrics naturally un-breach and the alerts auto-resolve, *then* a future re-breach exercises the now-working reactor. Manual UPDATE is only the right move if all six current breached / 0-active is itself a measurement bug (it is not, per KE-726/727/728).

## One-line takeaway

KE-728's import fix landed at 22:14:12Z (commit fb1999caa, option (c): inline `ctx.manager.callAgent`) and the reactor module now imports cleanly, but the 2 `metric.breach` events emitted at 21:47/21:52Z are permanently orphaned because (1) the bus does not replay pending events to handlers loaded post-emit and `events.status` is a vestigial column despite looking like a work-queue marker, and (2) `metrics-snapshot.ts:257-262` only emits on the breach *transition* (`!openAlert` gate), so as long as those 2 `metric_alerts` rows stay `resolved_at=NULL` no re-emission happens, leaving the now-working reactor starved of input — a wedge that will hold until either the breached metrics naturally recover (which without the reactor working is unlikely) or someone manually `UPDATE metric_alerts SET resolved_at`s the 2 stuck rows; KE-725's loadAlerts bug is also confirmed end-to-end for the second time (this heartbeat's prompt had no "Active alerts" block despite 2 unresolved rows).
