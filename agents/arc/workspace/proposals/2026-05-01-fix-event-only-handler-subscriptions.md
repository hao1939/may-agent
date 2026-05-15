# Proposal: Fix event-only handler subscriptions (cron.json `on:` path is dead)

**For:** tech-lead (runtime / cron loader) / Hao
**From:** arc heartbeat 2026-05-01 20:30Z
**Connects:** KE-455 (this proposal's KE), KE-454 (one symptom), KE-440/441/442/443 (the same metric-blindness thread)
**Urgency:** HIGH — `session-recovery` (Ambulance Protocol) has been inert since at least the start of the events table; the dev outage has been firing `session.failed` 62× in 24h with zero recovery dispatches. Every per-agent failure that should auto-recover is dying silently.
**Lane:** out of arc lane (runtime + `agents/may/cron.json`); proposal-only.

## Problem

Five handlers in `agents/may/cron.json` are configured `enabled:true` with **`on:[...]` and no `intervalMs`** (i.e. event-only):

- `session-recovery` ← `session.failed`
- `session-eval` ← `session.completed`
- `escalation` ← `session.escalated`
- `metric-alert-reactor` ← `metric.breach`
- `context-learn` ← `context-learn`

The events table records 62 `session.failed` rows in the last 24h (all from dev's 401 outage) and zero `handler.started` rows for `session-recovery` over the lifetime of the DB. Same null result for the other four. The `on:`-only subscription path does not deliver events to handlers.

Two of the affected handlers already have polling-based bandaid workarounds (`eval-poller.ts`, `context-learn-poller.ts`). Their headers explicitly state "nothing in the runtime emits [the source] event" / "bypasses the broken session.completed event chain." The other three handlers — including the **Ambulance Protocol** (`session-recovery`) — have no fallback.

Full evidence and mechanism analysis: `agents/shared/knowledge/entries/KE-455-event-only-handlers-never-fire-on-subscriptions-broken.md`.

## Why this matters

- The dev outage (running 19h+, KE-440 → KE-454) is the most visible cost: `session-recovery` is supposed to classify-and-act on each `session.failed` (resume / requeue / escalate). It has not run once. Without it, agent outages are invisible to anything except eyeball investigation.
- KE-454's recommended fix is to compute `handler.success-rate` from `sessions.status` (one-line metric change). Even with that fix in place, the *responder* — `metric-alert-reactor` — is event-only and has never fired. So KE-454 alone produces a red metric with nothing on the other end. KE-455's fix is the necessary complement: make the responders actually run.
- **Any new event-driven handler will inherit this defect.** The cron schema and existing handler files invite engineers to write `on:`-only handlers; they will be decoration.

## Proposed fixes (any combination ships value)

### Fix 1 (root cause): wire `on:`-only entries to the bus

Tech-lead investigation of the cron loader / event bus binding. Likely culprits:

- The cron runner only iterates entries with `intervalMs` set (an `if (entry.intervalMs)` somewhere drops `on:`-only entries).
- The bus uses a different event-name canonicalization than the cron loader (e.g. `session.failed` vs `session_failed`).
- The dispatch table is built once at startup and event-only entries are not registered.
- Some `enabled:true` check requires both a timer and an `on:` field.

A 30-minute audit of the runner's startup path against `cron.json`'s schema should reveal which it is. Test by emitting a synthetic `session.failed` event and grepping for the `handler.started` row.

### Fix 2 (immediate restoration of Ambulance Protocol): give `session-recovery` an `intervalMs` poll fallback

While Fix 1 is investigated, restore the recovery capability with the same pattern already used by `eval-poller` and `context-learn-poller`:

```jsonc
{
  "name": "session-recovery",
  "type": "job",
  "handler": "session-recovery",
  "intervalMs": 60000,
  "on": ["session.failed"],
  "enabled": true,
  "agent": "may",
  "description": "Auto-resume failed sessions (Ambulance Protocol). Polls sessions table every 60s for new error rows and dispatches recovery; also subscribes to session.failed for when Fix 1 lands."
}
```

The handler then needs a small wrapper that, when invoked without a triggering event (timer fire), queries `sessions WHERE status='error' AND startedAt > lastRunAt` and calls the existing per-event logic on each row. Keep the existing `event?.data` path for when the bus binding is fixed — both modes coexist cheaply.

This pattern is already in use; it works. It is the cheapest way to stop the bleed.

### Fix 3 (reduce future surprise): document which event types are emitted

Update `agents/shared/may-agent-docs/design/unified-events.md` to mark each declared event type with its current emission status (live / aspirational / deprecated). Add a one-line warning that `cron.json` `on:`-only handlers are not currently wired (until Fix 1 lands), and any new event-driven handler should include an `intervalMs` poll fallback. Two-paragraph diff.

## Recommendation

Ship all three. They compose:
- **Fix 2** restores the Ambulance Protocol *today* and stops the most visible bleed.
- **Fix 1** then closes the structural defect; once it lands, the `intervalMs` from Fix 2 becomes redundant (but cheap to keep as belt-and-suspenders).
- **Fix 3** prevents the next iteration of this same drift.

If only one is shipped, ship Fix 2.

## Verification

After Fix 2:
- Within 60 seconds of any `session.failed` row hitting `events`, expect a `handler.started` row with `handler:"session-recovery"`. Specifically: dev's outage continues to produce one `session.failed` every ~30 minutes; expect `session-recovery` to fire that often.
- Successful recoveries emit `agent.notification` or `session.escalated`. If dev is down due to token expiry (unrecoverable from inside the agent), expect classifier to escalate, not retry.

After Fix 1:
- Synthetic test: `bus.emit("session.failed", {sessionId:"test", agent:"x", error:"synthetic"})` should produce a `handler.started` row for `session-recovery` within 5s.
- Same test for `metric.breach` → `metric-alert-reactor`.

## Risks

- **Recovery loops.** If `session-recovery` resumes a failing session that immediately fails again, it could loop. The handler already has `MAX_RECOVERY_ATTEMPTS=2` (line 18 of `session-recovery.ts`) — confirm that limit applies in the timer-poll path too, not only the per-event path.
- **Polling cost.** 60s `intervalMs` is fine; eval-poller runs at 30min and is uneventful. If concerned, start at 120s.
- **Double-fire after Fix 1 lands.** The `on:` and `intervalMs` could both fire for the same session; the handler should be idempotent on `sessionId`. The recovery-attempts map already keys off `agent:taskPrefix`, which is close enough; a small dedup on `sessionId` would tighten it.

## Cost of doing nothing

The dev outage has been live ~19 hours. Sixty-two `session.failed` events have been emitted; zero have been auto-classified or auto-escalated. The next per-agent outage — token expiry, provider 5xx, runtime crash — will follow the same path: emit, drop, silent. Each iteration of the KE-440 family of entries (KE-440, 441, 442, 443, 454, 455) re-confirms this; none have changed it. Until a responder actually responds, more entries in the same family are predictable.
