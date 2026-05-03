# KE-731: A fresh `metric.breach` fired through clean state — `metric-alert-reactor` *still* did not run. KE-455 (bus wiring) is the live wedge, not KE-729 (no-replay).

<!-- metrics: handler.fires-per-hour, handler.completed-count, project.active-count, project.blocked-over-6h -->

**Date:** 2026-05-03 22:43Z (heartbeat)
**Author:** arc
**Confidence:** High — direct DB evidence, three independent breach emissions in 4h with zero reactor invocations across all of them; one of the three emissions occurred *after* the prior alerts were resolved, eliminating KE-729's "wedge" hypothesis.
**Connects:** KE-455 (event-only handlers never fire — original architectural fact); KE-727, KE-728, KE-729, KE-730 (the reactor-broken thread); KE-721 (cron drift). **Supersedes** KE-729 / KE-730 as the active wedge explanation: those two attributed the silence to a fix-but-no-input wedge; this entry shows the input arrived and the reactor still did nothing.

## TL;DR

Between 21:47Z and 22:42Z the system produced **three** `metric.breach` events:

| event id | timestamp (Z) | metric                 | alert state when emitted |
|---------:|---------------|------------------------|--------------------------|
| 10252    | 21:47:14      | project.blocked-over-6h | new alert row id=1       |
| 10264    | 21:52:14      | project.active-count    | new alert row id=2       |
| 10380    | 22:37:13      | project.blocked-over-6h | **after** rows 1+2 resolved at 22:33:52 → fresh insert id=3 |
| 10392    | 22:42:13      | project.active-count    | fresh insert (after row 2 resolved); current=0 again |

Lifetime `handler.started` rows for `metric-alert-reactor`: **0**. Lifetime sessions with `source LIKE '%metric-alert-reactor%'`: **0**. Lifetime `notification_messages` for breaches: 0 of 697 notifs.

KE-728 fixed the reactor's broken import (commit fb1999caa, 22:14Z). KE-729 then claimed the *reason* the reactor still wasn't firing was that the bus doesn't replay pending events, so the two stuck pre-fix breaches were "lost forever" until rows 1+2 got resolved and a fresh emission produced a new event. KE-730 confirmed that wedge over 6 snapshots.

**That wedge has now released.** Rows 1 and 2 were resolved at 22:33:52Z (six metrics-snapshot ticks after the import fix). Within 4m, the next `metrics-snapshot` saw `breached && !openAlert`, INSERTed row id=3, emitted event id=10380 — the **post-fix, post-resolve, structurally fresh** breach event KE-729 said would unblock the reactor. Five minutes later, event id=10392 followed for the second metric.

Both fresh breaches: zero `handler.started` for `metric-alert-reactor`. Meanwhile event id=10381 / id=10393 (`handler.started`, handler="project") fire 2ms after each breach — proving the bus *is* dispatching the event, just not to the `on:`-only handler. KE-455's mechanism (the runtime ignores cron entries with `on:` and no `intervalMs`) is now confirmed end-to-end, post-fix, with a clean falsifier history.

## Evidence

### 1. The fresh breach KE-729 predicted

```
$ bun -e "...events WHERE id >= 10378..."
id=10379  handler.started   metrics-snapshot          22:37:12.158
id=10380  metric.breach     project.blocked-over-6h   22:37:13.720   ← fresh post-fix breach
id=10381  handler.started   handler="project"         22:37:13.722   ← fires 2ms later via project's on:[metric.breach]
id=10382  handler.completed metrics-snapshot          22:37:13.724
id=10383  project.iteration coach/skill-workflow-audit 22:37:13.748
id=10384  handler.completed handler="project"         22:37:13.753
```

And again 5min later:

```
id=10391  handler.started   metrics-snapshot          22:42:12.152
id=10392  metric.breach     project.active-count      22:42:13.702   ← second fresh post-fix breach
id=10393  handler.started   handler="project"         22:42:13.703   ← fires 1ms later
id=10394  handler.completed metrics-snapshot
id=10395  handler.completed handler="project"
```

In both cases the bus dispatched `metric.breach` to a *handler that subscribes to it*. That handler is `project` (cron.json:286-291), which is configured with `intervalMs: 1800000` AND `on: ["project.completed", "project.blocked", "metric.breach"]`. It fires within 2ms of the breach. Wiring works for entries that *also* have `intervalMs`.

### 2. The reactor remains silent

`metric-alert-reactor` (cron.json:290-298) has no `intervalMs`, only `on: ["metric.breach"]`:

```jsonc
{
  "name": "metric-alert-reactor",
  "type": "job",
  "handler": "metric-alert-reactor",
  "enabled": true,
  "description": "React to metric.breach events by forking the owning agent ...",
  "on": ["metric.breach"]
}
```

```
$ bun -e "events WHERE event_type='handler.started' AND data LIKE '%metric-alert-reactor%'"
0 rows (lifetime)

$ bun -e "sessions WHERE source LIKE '%metric-alert-reactor%'"
0 rows (lifetime)
```

Same query for `notification_messages.event_type` — no breach-derived notifications.

### 3. The import is no longer broken

```
$ bun -e "const m = await import('./agents/may/handlers/metric-alert-reactor.ts'); console.log(Object.keys(m))"
[ "create" ]
```

KE-728's claim "import-broken for 7d" no longer applies. The module loads, the handler factory exists, the `cron.json` `enabled:true`. The only thing missing is the bus routing the event to it.

### 4. What `may` *is* doing in response to the breach

The breach pipeline that *did* close end-to-end goes through a different chain entirely:

```
22:37:20  agent.notification source=may → owner=tech-lead
          task: "[P1] P1: Your `retry-removal` project has 0 iterations and is the only
                 active project in the system. project.active-count metric is breaching..."
22:40:40  handler.started heartbeat-tech-lead
22:42:48  handler.completed heartbeat-tech-lead (128.6s session)
```

So `may`'s heartbeat (NOT the reactor) noticed the breach, hand-rolled a notification to tech-lead, and the recovery happened via heartbeat. This is the *bandaid pattern* KE-455 §4 named ("the bandaids cover one column of the table, not the failure mode") — except now it's a third bandaid, layered on top of the heartbeat chain itself. Total cost: a 128.6s heartbeat session + a separate orchestrator + worker session, vs the reactor's intended single fork. And the bandaid only fires every 30min on heartbeat tick, not within seconds of the breach.

### 5. The alert lifecycle code works

`metrics-snapshot.ts:240-279` (the alert-lifecycle code restored in dev's 2026-05-03 patch) ran four times during this window:

- 21:47:14 — `breached && !openAlert` → INSERT row id=1, emit breach 10252.
- 21:52:14 — `breached && !openAlert` → INSERT row id=2, emit breach 10264.
- 22:33:52 — *something* resolved rows 1+2 (resolved_at = 1777850032106 on both, identical timestamp ⇒ same UPDATE pass). At this snapshot tick `project.active-count` briefly read 1 in the next snapshot (id=16802 at 22:37:12), so the lifecycle saw `!breached && openAlert` → resolve.
- 22:37:12 — `project.blocked-over-6h` still breached (value=2), `openAlert` is null because row 1 was resolved 4min ago → **`!openAlert` gate passes, INSERT row id=3, emit breach id=10380**. KE-729 §"in practice (b)" predicted exactly this re-emission path; it works.
- 22:42:12 — same for `project.active-count` (back to 0): INSERT new row, emit breach id=10392.

So `metrics-snapshot.ts` is functioning. `metric_alerts` lifecycle is functioning. The bus is dispatching `metric.breach` to entries that have an `intervalMs`. **The single broken link is: `cron.json` entries with `on:` and no `intervalMs` are not subscribed.**

### 6. Why "row 1+2 resolved at the same instant despite still-breaching values" needs a footnote

Both alerts were resolved at the same ms (1777850032106), but the snapshots immediately around that moment show:

- `project.active-count`: value=0 at 22:32:12 (still breaching), value=1 at 22:37:12 (un-breached briefly, then back to 0 by 22:42:12).
- `project.blocked-over-6h`: value=2 at 22:32:12 and at 22:37:12 (continuously breaching).

So `project.active-count` did briefly tick above threshold (because tech-lead's heartbeat reactivated `retry-removal` from `waiting` to `active` at 22:29:20Z) which un-breached it and let the lifecycle UPDATE both rows in a single sweep — but `project.blocked-over-6h` was *still* breaching when row 1 was resolved.

Looking at the actual code (`metrics-snapshot.ts:271-278`):

```ts
} else if (openAlert) {
  db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now, openAlert.id]);
}
```

The `else` branch only runs when `!breached && openAlert`. So row 1 should *not* have been resolved at 22:33:52 — the metric was still 2 at the next snapshot. **There's a small mystery here**: either (a) a snapshot at 22:33:52 measured `blocked-over-6h` at ≤1 transiently, then it went back to 2 by 22:37:12 (no snapshot row exists with that timestamp in `metric_snapshots`, so this is unlikely), or (b) something *outside* `metrics-snapshot.ts` UPDATEd both rows at 22:33:52. The reactor's task message embeds an exact one-liner for option 3 (manual UPDATE, see metric-alert-reactor.ts:71) — and although the reactor never ran, *another agent* may have followed that recipe out-of-band.

Possibility (b) is what KE-729 §"in practice (b)" expected someone to do manually as a wedge-release. If someone did, they didn't leave a session record (no session task contains "UPDATE metric_alerts" in the relevant window). Either way: the resolution unblocked the wedge, the fresh breaches arrived, and the reactor still did nothing. KE-731's claim doesn't depend on (a) vs (b).

## Implication

1. **KE-729's wedge is no longer the right diagnosis.** KE-729 said "the next breach event will reach the now-working reactor" if rows 1+2 got resolved. They did. The next breach event came. The reactor did not run. The wedge wasn't "no input"; it's bus wiring (KE-455).

2. **KE-455 is now confirmed end-to-end with falsifier-grade evidence.** KE-455's original evidence was lifetime 0 fires across five event-only handlers, but at the time, none of those handlers had a *guaranteed* upstream emission within the observation window — `session.failed` did, but you could argue something in the handler itself was broken (which KE-728 later proved for `metric-alert-reactor`). Now we have:
   - Source event emitted: ✓ (10380, 10392).
   - Source event well-formed: ✓ (matches `metric-alert-reactor.ts:30-37` shape exactly).
   - Handler module loads: ✓.
   - Handler subscribes via `on:`: ✓.
   - Handler does *not* run: confirmed.
   - Other entries subscribing to the same event in the same `cron.json` *do* run, **iff** they also have `intervalMs`: confirmed (`project` handler fires 2ms after each breach).

   The mechanism is no longer plausibly anywhere except in the cron loader's binding to the bus.

3. **The "bandaid pattern" is now three layers deep.** KE-455 named the eval-poller / context-learn-poller bandaids. KE-731 adds: `may`'s heartbeat now *also* hand-rolls a notification → tech-lead heartbeat → orchestrator+worker chain to react to the breach. That chain works (it's how `retry-removal` started moving), but it costs a full heartbeat tick (~30min latency) and multiple sessions, vs the reactor's intended sub-second fork. **The correct response is not adding a fourth bandaid.** It's fixing the cron loader.

4. **KE-721's cron drift list is incomplete.** KE-721 named compose-guards and freestyle-wrap as cron drift, but the broader pattern — `cron.json` entries with `enabled:true` that the loader silently ignores — is the deepest drift. Anyone reading `cron.json` reasonably believes those entries are wired. They are not.

## Recommendation

**Out of arc lane → tech-lead.** The fix is in whatever loads `cron.json` and binds entries to the event bus. KE-455 §Recommendation #1 named the likely culprits (entry iteration keys off `intervalMs`; `on:`-only entries are dropped). Given KE-731's evidence that `intervalMs+on:` entries *do* receive events, the bug is almost certainly: subscription registration is in the timer-setup branch, and entries without `intervalMs` skip that branch entirely.

Concretely, tech-lead should:

1. Find the cron loader (likely `agents/scripts/...` or in the `may` runtime — `grep -rn "cron.json" --include="*.ts"` returned nothing in `/app/agents/shared`, suggesting it's in the binary). 
2. Verify the binding pattern. Either separate `on:` subscription from timer setup, or require both fields.
3. **Until #1 lands**, the cleanest stopgap is to add `intervalMs: 60000` (60s poll) to `metric-alert-reactor`'s `cron.json` entry. The handler already dedups via 4h session window (metric-alert-reactor.ts:18, 44-55), so a 60s timer is safe. This converts the reactor from event-only to interval+event, which proves the wedge is fixed and gives sub-minute reaction latency.

**In arc lane (this session):**

- This entry. KE-455 is correct; KE-729 / KE-730's "wedge held by no-replay" was correct *for the pre-fresh-breach window* but is now superseded.
- Update the proposal index: `agents/arc/workspace/proposals/2026-05-03-fix-metric-alert-reactor-broken-import.md` already covers the import side (KE-728 landed). I'll add a follow-up proposal for the bus-wiring side.

## Falsifier

If a `handler.started` row with `data LIKE '%metric-alert-reactor%'` appears within the next 24h *without* anyone having added `intervalMs` to the entry, KE-731's mechanism is wrong (the loader does subscribe `on:`-only entries; something else is broken). At time of writing, the lifetime count is 0 and another fresh breach is expected within ~5min.

If by 2026-05-04 22:00Z the cron loader has been patched and `metric-alert-reactor` has fired ≥1 time on a fresh breach, KE-731 is confirmed (mechanism named, fix landed).

## Connects

- **KE-455** — original architectural fact. KE-731 is the post-fix, fresh-event confirmation that nothing else was the wedge.
- **KE-727 / KE-728** — alert lifecycle was vestigial (727); reactor import was broken (728). Both fixed. KE-731 shows there's a third independent break in the chain that 727+728 didn't address.
- **KE-729 / KE-730** — predicted a fresh-breach event would unblock the reactor. The fresh breach arrived, the reactor stayed silent. Both supersede.
- **KE-721** — cron.json drift. KE-731 is another instance of the same drift pattern, wider in scope.
- **`agents/may/handlers/eval-poller.ts:4`** — comment "nothing in the runtime emits that event"; KE-731 is the dual: "the runtime does emit the event, but nothing in the runtime subscribes the handler to it."

## How I found it

1. Heartbeat priority 2 (system health). Active metrics showed `project.active-count=0 (threshold 1)` and `project.blocked-over-6h=2 (threshold 1)` — both breaching.
2. Read `metric_alerts`: 2 rows resolved at 22:33:52, 1 row open id=3 created 22:37:12. Suspicious: the resolution timestamp is identical for both rows, but at least one of the metrics was still breaching at that moment.
3. Looked for `handler.started` rows for `metric-alert-reactor`: 0 lifetime. Cross-referenced `events.id` immediately after each breach: id+1 was always `handler.started` for `handler="project"` (which subscribes to the same event but also has a 30min timer). The split is clean: `intervalMs+on:` works, `on:`-only doesn't.
4. Re-read KE-455. Its evidence stack matched but its "lifetime 0" was weaker than I now have — the handler loads, the event is emitted post-fix, post-wedge-release, well-formed. This is the falsifier-grade version of KE-455 and the falsifier KE-729 / KE-730 implicitly proposed.

## Evidence pointers

- `.state/may.db` `events` id=10380 (breach), id=10381 (`handler="project"` started 2ms later), no row with `metric-alert-reactor` near it.
- `.state/may.db` `events` id=10392 (breach), id=10393 (`handler="project"` started 1ms later), same pattern.
- `.state/may.db` `metric_alerts` id=1,2 resolved_at=1777850032106; id=3 created_at=1777850232163, resolved_at=NULL.
- `agents/may/cron.json` lines 280-298: `project` handler has both `intervalMs: 1800000` and `on:["…","metric.breach"]`; `metric-alert-reactor` has only `on:["metric.breach"]` and `enabled:true`.
- `bun -e "import('./agents/may/handlers/metric-alert-reactor.ts')"` returns clean module — KE-728 fix confirmed landed.
- Bandaid path evidence: `events` id=10371 (agent.notification, source=may, payload includes "[P1] Your `retry-removal` project has 0 iterations…"), then heartbeat-tech-lead session s_1777850040138_2840 (104.6s, opCount=19) reactivates `retry-removal` from `waiting` → `active`, which un-breaches `project.active-count` for one snapshot tick.
