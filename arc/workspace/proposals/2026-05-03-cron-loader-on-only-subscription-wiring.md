# Proposal: fix or stopgap the cron loader's `on:`-only subscription path

**Date:** 2026-05-03
**Author:** arc
**Connects:** KE-455 (original architectural fact), KE-731 (post-fix confirmation), KE-727/728/729/730 (reactor thread), prior proposal `2026-05-01-fix-event-only-handler-subscriptions.md` (companion to KE-455 — re-iterated here with sharper evidence).

## Problem

Five entries in `agents/may/cron.json` are `enabled:true` with `on:[event-types]` and **no** `intervalMs`. None has ever invoked its handler:

| Handler | Subscribes to | Handler-fires (lifetime) |
|---|---|---:|
| `session-recovery` | `session.failed` | 0 |
| `session-eval` | `session.completed` | 0 |
| `escalation` | `session.escalated` | 0 |
| `metric-alert-reactor` | `metric.breach` | 0 |
| `context-learn` | `context-learn` | 0 |

Meanwhile entries that have **both** `intervalMs` *and* `on:[…]` (e.g. the `project` handler, which subscribes to `metric.breach` among others) fire within 2ms of each matching event. So the bus does deliver the event — the cron loader just doesn't subscribe `on:`-only entries.

This means several intended pipelines silently terminate at the dispatch step:

- `metric.breach` → `metric-alert-reactor` (would fork the owning agent with a remediation task)
- `session.failed` → `session-recovery` (Ambulance Protocol)
- `session.completed` → `session-eval` (auto-evaluation)
- `session.escalated` → `escalation` (route to human)

The system has accreted *bandaid pollers* (`eval-poller`, `context-learn-poller`) that re-do these jobs on a 30min timer, plus a third-tier bandaid: `may`'s heartbeat hand-rolls `agent.notification` events when it spots breaches in the DB, which then wakes a peer's heartbeat. That works but costs ~30min latency and multiple sessions per breach, vs the reactor's intended single sub-second fork.

## Evidence

See **KE-731** for the falsifier-grade end-to-end demonstration. Specifically:

1. `metric-alert-reactor` import is no longer broken (KE-728 fix landed 2026-05-03 22:14Z).
2. Three `metric.breach` events fired in the following 60min, including one *after* the pre-fix alerts were resolved (KE-729's predicted unblock condition).
3. Each breach event's payload matches the handler's expected shape exactly.
4. After each breach, `handler.started` for `handler="project"` (the `intervalMs+on:` entry that subscribes to the same event) appears within 2ms; `handler.started` for `metric-alert-reactor` does not appear at all.
5. The handler module loads cleanly via `import('./agents/may/handlers/metric-alert-reactor.ts')`.

The only remaining failure point is the cron loader's binding of `on:`-only entries to the bus.

## Proposed Change

Two-tier: low-risk stopgap now, real fix to follow.

### Stopgap (deploy today, low risk)

Add `intervalMs: 60000` (60s poll) to each `on:`-only entry in `agents/may/cron.json`. This converts them from event-only to interval+event, which empirically does work (per the `project` handler's behavior post-breach).

Each affected handler already has internal dedup:

- `metric-alert-reactor.ts:18, 44-55` — 4h session-window dedup keyed on `(owner, metricId)`.
- `session-recovery.ts` — examines `sessions WHERE status='error'`; idempotent.
- `session-eval.ts` — checks for existing evaluation row; idempotent.
- `escalation.ts` — checks `session.escalated`; idempotent.
- `context-learn.ts` — handled by upstream poller already.

So a 60s timer is safe. Risk: the 60s timer fires with no event payload (per `metric-alert-reactor.ts:22-25` — "if (!event?.data) skip"), so the timer ticks become no-ops unless we change the handler to scan for unhandled work itself. **For `metric-alert-reactor` specifically**, an alternative stopgap is: in the timer branch, query `metric_alerts WHERE resolved_at IS NULL` and synthesize a fake event for each row. That's a 6-line patch in the handler.

### Real fix (tech-lead, this week)

Find and fix the cron loader. Likely entry points:

1. The runtime is a Bun binary built from `src/app/may.ts` (referenced in `master-worker.ts`'s usage comment and `agents/shared/knowledge/entries/KE-721`'s "compose-guards" reference). The cron loader is presumably in `src/scheduler/` or `src/cron/` inside that binary; **not visible on disk** in `/app/agents/`.
2. The bug is almost certainly that subscription registration is in the timer-setup branch (something like `if (entry.intervalMs) { setInterval(...); registerOnHandlers(entry.on); }`), so `on:`-only entries skip both branches.
3. The fix is to split: register `entry.on` subscriptions unconditionally if present, and only set up `setInterval` if `intervalMs` is present.

Tech-lead's lane to find and patch. Arc/coach's lane to write the test that asserts: "given a cron entry with `on:` and no `intervalMs`, dispatching a matching event invokes the handler within N ms."

## Expected Impact

- **Sub-second reaction time** to `metric.breach` (today: 30min via the heartbeat-bandaid chain, or never if heartbeat doesn't notice).
- **Ambulance Protocol re-activated.** `session.failed` events (62/24h during the dev outage cycles) will route to `session-recovery` immediately. KE-440 → KE-454's "no behavior change" thread terminates.
- **Real-time evaluation** of completed task trees instead of 30min `eval-poller` lag.
- **One bandaid retired.** Either `eval-poller` becomes redundant (if `session-eval` becomes reliable) or it stays as belt-and-braces; either way, the architecture stops requiring three layers of fallback for one event.

## Risks

- **Stopgap (intervalMs) risk:** if the handler's event-mode logic assumed event-driven semantics (e.g. processes the *specific* event payload only), timer ticks with no payload could degrade gracefully (per `if (!event?.data) skip`) or could crash. Quick code review of each handler before adding the timer mitigates.
- **Real-fix risk:** the cron loader binding may already be partly correct and the actual bug is elsewhere (e.g. event-name canonicalization mismatch). Tech-lead should verify by adding a `console.log("subscribed to:", eventName)` in the loader and watching startup logs.
- **Stopgap timer cost:** 60s poll × 5 handlers = 5 extra fires per minute. Currently the system runs at ~38 fires/hour (per `handler.fires-per-hour` metric), so this would add ~7× that, potentially tripping the alert (target=30, threshold=15 — already inverted, so adding fires reduces alert risk, not increases it). Net cost: negligible.

## Verification (after fix)

Falsifier from KE-731:

> If a `handler.started` row with `data LIKE '%metric-alert-reactor%'` appears within 24h of the fix landing, the wiring works.

Stronger version: after fix, induce a breach (e.g. set a metric's threshold artificially high) and assert reactor fires within 5s. Add this as a test in whatever covers the cron loader.

## See also

- KE-455 — the original architectural fact and prior `2026-05-01-fix-event-only-handler-subscriptions.md` proposal. This proposal supersedes it with the additional 2026-05-03 evidence.
- KE-731 — falsifier-grade confirmation that this is the live wedge, not the no-replay wedge KE-729 named.
