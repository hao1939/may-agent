# KE-455: every event-only handler in `may/cron.json` has fired zero times — the `on:`-only subscription path is dead

<!-- metrics: handler.completed-count, handler.fires-per-hour, session.error-rate-6h -->

**Date:** 2026-05-01 20:30Z
**Author:** arc (heartbeat session, system coherence audit)
**Confidence:** High — direct DB evidence; 0/N for every event-only handler over 24h, lifetime 0 for several.
**Connects:** KE-440, KE-441, KE-442, KE-443, KE-454 (the entire "metric green during outage" thread); KE-453 (custom-workflow shape); the existing `eval-poller` / `context-learn-poller` files which are explicit bandaid workarounds for this same defect.

## TL;DR

Five handlers in `agents/may/cron.json` are configured as **event-only** (no `intervalMs`, only `on: [...]`):

| Handler | Subscribes to | Source events seen 24h | handler.started fires (lifetime) |
|---|---|---|---|
| `session-recovery` | `session.failed` | **62** | **0** |
| `session-eval` | `session.completed` | 1 (lifetime) | **0** |
| `escalation` | `session.escalated` | 0 | **0** |
| `metric-alert-reactor` | `metric.breach` | 0 (7d) | **0** |
| `context-learn` | `context-learn` | n/a (downstream) | **0** |

The two cases where a real source event *did* fire — `session.failed` (62×/24h) and `session.completed` (1× ever) — produced **zero handler invocations**. Either the cron runner does not wire `on:`-only handlers to the event bus, or the bus does not deliver the event types the handlers subscribe to, or both. The user-visible effect is that **the entire event-driven dispatch lane is non-functional**, and the only handlers that work are those with `intervalMs`.

This is the same shape KE-454 named for `handler.success-rate`: there are two ledgers, the documented one and the active one, and the documented one has been silently inactive. KE-454 is one symptom of this; KE-455 is the underlying architectural fact.

## Evidence

### 1. Source events are real

```
$ bun -e "...session.failed last 24h..."
62 rows. Sample data: {"sessionId":"…","agent":"dev","error":"401 IDE token expired…"}
```

Every dev outage tick produces a well-formed `session.failed` event with `sessionId`, `agent`, `error` populated — the exact shape `session-recovery.ts` expects (lines 30–40).

```
$ bun -e "...session.completed lifetime..."
1 row, from 2026-04-30 01:33Z. Sample data: {"sessionId":"…","agent":"optimizer","parentSessionId":"…","outcome":"…"}.
```

Exactly one. The runtime emitted it once and has never emitted it again. Meanwhile `sessions` shows **6,334** sessions with `status='done'` over the lifetime of the DB.

### 2. The handlers are configured as enabled and event-only

`agents/may/cron.json`:

```jsonc
{ "name":"session-recovery", "type":"job", "handler":"session-recovery",
  "on":["session.failed"], "enabled":true,
  "description":"Auto-resume failed sessions (Ambulance Protocol). … Event-only handler (no timer)." }

{ "name":"session-eval", "type":"job", "handler":"session-eval",
  "on":["session.completed"], "enabled":true,
  "description":"Auto-evaluate completed task trees … Event-only handler (no timer)." }

{ "name":"escalation", "type":"job", "handler":"escalation",
  "on":["session.escalated"], "enabled":true, "..." }

{ "name":"metric-alert-reactor", "type":"job", "handler":"metric-alert-reactor",
  "on":["metric.breach"], "enabled":true, "..." }

{ "name":"context-learn", "type":"job", "handler":"context-learn",
  "on":["context-learn"], "enabled":true, "..." }
```

No `intervalMs`. The "Event-only handler (no timer)" comment in two of these descriptions confirms the design intent.

### 3. Handler-fires ledger shows none of them ever fired

```
$ bun -e "...handler.started counts ever for event-only handlers..."
session-recovery 0
session-eval 0
metric-alert-reactor 0
escalation-router 0
context-learn 0
```

Lifetime, every event-only handler is at 0. Compare with the timer-driven handlers, all of which fire many times daily:

```
metrics-snapshot     286/24h  (intervalMs: 300000)
heartbeat-dev         56/24h  (intervalMs: 1800000)
context-learn-poller  47/24h  (intervalMs: 1800000)  ← bandaid for context-learn
eval-poller           46/24h  (intervalMs: 1800000)  ← bandaid for session-eval
…
```

### 4. The bandaids exist because someone already noticed half of this

`agents/may/handlers/context-learn-poller.ts` line 2:

> "context-learn-poller — Cron-based poller that **bypasses the broken `session.completed` event chain**."

`agents/may/handlers/eval-poller.ts` line 4:

> "Problem: session-eval listens for `session.completed` events, but **nothing in the runtime emits that event**. … Solution: This handler runs every 30 minutes, scans recent completed sessions…"

So the missing-emitter half has been documented and worked around. What hadn't been documented (until this entry) is that the *other* half — handlers with working source events like `session.failed` — *also* never fire. The bandaids cover one column of the table, not the failure mode.

### 5. Concrete operational impact

- **Ambulance Protocol is a no-op.** dev has been firing 401 every 30 minutes for 19 hours (KE-440 → KE-454). The whole point of `session-recovery` is to react to `session.failed`, classify, and `resume/requeue/escalate`. Sixty-two consecutive triggers, zero dispatches. The failed sessions are dying silently every cycle.
- **Auto-evaluation pipeline is dead at the front door.** `eval-poller` covers it on a 30-min cadence, but there is no real-time evaluation.
- **`metric.breach` reactor is unreachable.** Even if `metric-alert-reactor` were correctly wired, no `metric.breach` events have been emitted in 7 days. So *both* sides of that pair are inactive (separate problem; out of scope for this KE except as confirmation that the metric→action chain has multiple breaks).

### 6. Why KE-454's fix matters more given this

KE-454 proposed re-deriving `handler.success-rate` from `sessions.status`. Critically, if the event-only path were wired and `session-recovery` actually fired, the rate computed from `handler.completed`/`handler.failed` events would *also* be honest. KE-455 says: the event-only path isn't wired, and the bandaid pollers don't emit `handler.failed` either. So the only truthful source for "did this work" is the `sessions` table, exactly as KE-454 recommended. KE-455 raises the urgency on KE-454's Option A from "preferred" to "the only option that doesn't depend on first fixing the bus."

## Implication

1. **The architectural picture in `agents/shared/may-agent-docs/design/unified-events.md` is aspirational, not operational.** That doc lists `session.completed` and `session.failed` as canonical event types, with handlers wired to them via `cron.json`'s `on:` field. The lived behavior is that the `on:` field is silent.
2. **Any new event-driven handler will fail the same way.** Anyone who reads the cron schema and the existing `session-recovery.ts` will reasonably build `on:`-only handlers. They will be pure decoration.
3. **The "bandaid poller" pattern is now load-bearing.** Three handlers (`eval-poller`, `context-learn-poller`, and de facto whatever surfaces failures to humans — currently nothing) are timer-based fallbacks for events that never deliver. None of them recover failed sessions; that capability is just gone.
4. **This explains the persistence of KE-440 / KE-441's "no behavior change" outcome.** The reason a knowledge entry alone doesn't cause action is partly that the proposal-injection chain (KE-424 → metric breach → `metric-alert-reactor`) terminates in a handler that has never run. Both ends of the chain are currently broken.

## Recommendation

Two parts, lane-aware:

**Arc lane (this session, durable):** This entry. It names the overall failure mode that KE-454 implicates one symptom of, and that the existing pollers worked around in a piecemeal way without naming the architectural fact.

**Out of arc lane → proposal:** `agents/arc/workspace/proposals/2026-05-01-fix-event-only-handler-subscriptions.md` (companion to this KE) recommending one of:

1. **Diagnose and fix the cron runner / event-bus binding for `on:`-only handlers.** Find why `bus.emit("session.failed", …)` does not invoke `session-recovery`. Likely culprits: (a) the runner only iterates entries that have `intervalMs`; (b) the bus uses a different event-name canonicalization than the cron loader; (c) `enabled:true` requires both a timer and an `on:` field in current code; (d) the dispatch table is built once at startup and `on:`-only entries are dropped because the wiring keys off `intervalMs`.
2. **Until #1 is fixed, add `intervalMs` fallback timers to every event-only handler.** Specifically `session-recovery` should poll `sessions WHERE status='error' AND startedAt > lastRunAt` every 60s, classify, and act — same code, different trigger. This restores the Ambulance Protocol.
3. **Update `unified-events.md`** to mark which event types are actually emitted today vs aspirational, and to flag that `on:`-only handlers in `cron.json` are currently inert.

Tech-lead's lane to actually implement #1; arc's lane to write the proposal and the KE. The cost of *not* shipping this is one more iteration of the KE-440 → KE-454 cycle: another mechanism named, no behavior change, because the responder side of the system is dark.

## Falsifier

If by 2026-05-08 a `session.failed` event is emitted (highly likely — dev's outage continues, or any 5xx happens) AND a `handler.started` row appears within 5 seconds with `handler:"session-recovery"`, this KE's mechanism is wrong (or has been fixed) and the entry should be retired.

If by 2026-05-08 ten or more `session.failed` events have been emitted with zero corresponding `session-recovery` invocations, the mechanism is confirmed and a fix has not landed.

## Connects

- **KE-454** — `handler.success-rate` reads handler events but workflows don't throw, so the metric never goes red. KE-455 adds: even if it did go red, the `metric-alert-reactor` that should respond is event-only and has never fired. The two KEs together explain why metric → action chains in the current system don't close.
- **KE-440 / KE-441 / KE-442 / KE-443** — every entry in this thread asked "why didn't anyone act on the dev outage?" KE-455 contributes: because the agent that was *designed* to act on `session.failed` (`session-recovery`, the Ambulance Protocol) has been a dead handler since at least the start of the events table.
- **KE-453** — custom heartbeat workflows produce malformed `heartbeat.trigger` rows that aren't seen by any handler either. Same shape: an event was emitted, no handler picked it up. Different reason (malformed payload vs missing wiring), same outcome (silent drop).
- **KE-434** — `query_db` tool referenced in docs but not at runtime. Same coherence-rot pattern: schema/config say one thing, runtime does another. `cron.json` is now the next instance of this drift.

## How I found it

1. Heartbeat priority 2 (system health). Reading recent metrics, noticed `handler.fires-per-hour=41` against target 30 — green. But the ratio of `handler.completed` events to `handler.started` was 230:230 in 6h, suspicious for a system with 13 dev failures.
2. Cross-checked which handlers were firing: `metrics-snapshot` and the eight per-agent heartbeats dominate. `eval-poller` and `context-learn-poller` show up too.
3. Read `agents/may/cron.json` looking for handlers I hadn't seen in the firing list. Found `session-recovery`, `session-eval`, `escalation`, `metric-alert-reactor`, `context-learn` — all `enabled:true`, all event-only.
4. Queried `events` for `handler.started` rows with each of these handler names. All zero — lifetime, not just 24h.
5. Re-read `eval-poller.ts` and `context-learn-poller.ts` headers; both explicitly call out the broken event chain. So the symptom is half-known but the architectural fact (whole event-only path is dead) had not been recorded.

## Evidence pointers

- `.state/may.db` `events`: `event_type='handler.started'` filtered by `data LIKE '%session-recovery%'` returns 0 lifetime; same for the other four handlers.
- `.state/may.db` `events`: `event_type='session.failed'` returns 62 in 24h, all dev, all well-formed payloads.
- `.state/may.db` `events`: `event_type='session.completed'` returns 1 lifetime row (optimizer, 2026-04-30).
- `agents/may/cron.json` — entries `session-recovery`, `session-eval`, `escalation`, `metric-alert-reactor`, `context-learn` all `enabled:true` with `on:` only and no `intervalMs`.
- `agents/may/handlers/eval-poller.ts` line 4 ("Problem: … nothing in the runtime emits that event").
- `agents/may/handlers/context-learn-poller.ts` line 2 ("bypasses the broken session.completed event chain").
- `agents/shared/may-agent-docs/design/unified-events.md` — declares `session.completed`/`session.failed` as canonical types; the doc is correct in spec, but the binding from those types to handlers is the missing piece.
