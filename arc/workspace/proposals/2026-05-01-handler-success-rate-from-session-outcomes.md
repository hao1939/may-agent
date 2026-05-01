# Proposal: Compute `handler.success-rate` from session outcomes, not handler events

**For:** dev (once IDE-token outage clears) / tech-lead / Hao
**From:** arc heartbeat 2026-05-01 19:58Z
**Connects:** KE-440, KE-441, KE-442, KE-443, KE-454, and the still-open dev IDE-token outage (~19h as of writing)
**Urgency:** HIGH — fixes the structural blindness behind the entire KE-440 → KE-454 thread with a one-line metric change. Without it, no per-agent outage will ever turn the system-health metric red.
**Lane:** out of arc lane (`agents/may/handlers/metrics-snapshot.ts`); proposal-only.

## Problem

`handler.success-rate` is computed in `agents/may/handlers/metrics-snapshot.ts:104-107` as:

```ts
completed = count("SELECT COUNT(*) FROM events WHERE event_type='handler.completed' AND timestamp > ?", sixH);
failed    = count("SELECT COUNT(*) FROM events WHERE event_type='handler.failed'    AND timestamp > ?", sixH);
record("handler.success-rate", completed / Math.max(1, completed + failed));
```

But:
- `handler.failed` is only emitted when a workflow function **throws**.
- Workflows do not throw on failed inner sessions; they catch the result and return `{status: "error", ...}` (see `agents/dev/workflows/dev-heartbeat.ts:11-17`, and the same pattern in `genericHeartbeat`).
- So a dev heartbeat that produces a 401-IDE-token-expired session emits both `session.failed` (from the runtime) **and** `handler.completed` (from the workflow returning normally) at the same timestamp. KE-454 confirms this: 42/42 dev `session.failed` events in the last 24h are paired with a `handler.completed` within 30s.

Result:
- `handler.failed-count` = **0** for the last 6h.
- `handler.success-rate` = `13 / (13+0)` = **1.00** (GREEN).
- Meanwhile `sessions` table shows dev: 0 done, 13 error — 100% failure for the entire 6h window.

The metric is structurally incapable of going red on a per-agent outage that doesn't crash the workflow runner. Token expiry, circuit-breaker fast-return (KE-442), provider 5xx, runtime hangs that resolve to `status:"error"` — none of them move the needle.

## Fix

### Option A (preferred): re-derive `handler.success-rate` from `sessions.status`

In `agents/may/handlers/metrics-snapshot.ts`, replace lines 104–107 with:

```ts
const total = count(
  "SELECT COUNT(*) FROM sessions WHERE startedAt > ? AND status IN ('done','error','failed')",
  sixH);
const done = count(
  "SELECT COUNT(*) FROM sessions WHERE startedAt > ? AND status = 'done'",
  sixH);
record("handler.success-rate", total === 0 ? 1 : done / total);

// Keep these for diagnostics, but stop using them for the headline rate:
const handlerCompleted = count("SELECT COUNT(*) FROM events WHERE event_type='handler.completed' AND timestamp > ?", sixH);
const handlerFailed    = count("SELECT COUNT(*) FROM events WHERE event_type='handler.failed'    AND timestamp > ?", sixH);
record("handler.completed-count", handlerCompleted);
record("handler.failed-count",    handlerFailed);
```

This catches outages that produce `session.failed` rows regardless of whether the workflow threw. It is also more honest: "success rate" should mean "fraction of sessions that did the work," not "fraction of workflow invocations that didn't throw an unhandled exception."

Effect on the current state: with 14 `done` and ~13 `error` sessions in the last 6h, the rate would be ≈ **0.52** — well below the threshold of 0.8 — and KE-424's existing injection chain would surface this in may's heartbeat prompt automatically. The dev outage would have been visible to may within one heartbeat cycle.

### Option B: emit `handler.failed` when the workflow returns `status:"error"`

In the workflow runner (closed-source per arc's view), wrap the awaited workflow result and check whether `result.status === "error"`. If so, emit `handler.failed` instead of (or in addition to) `handler.completed`. This is the more invasive fix but has the upside of keeping the existing metric semantics intact.

### Option C (cheap dashboard companion, complements A): add `agent.zero-success-6h`

This is KE-440's original recommendation. Independent of A/B; ship it anyway. ~20 lines in `metrics-snapshot.ts`:

```ts
const offlineAgents = db.query(`
  SELECT agent FROM sessions
  WHERE startedAt > ?
  GROUP BY agent
  HAVING COUNT(*) >= 3 AND SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) = 0
`).all(sixH);
record("agent.zero-success-6h", offlineAgents.length, {
  detail: offlineAgents.map(r => r.agent).join(",")
});
```

Threshold ≥1. Currently fires (dev). Fires on any future per-agent outage. Catches the symptom even if A and B both regress.

## Recommendation

Ship A + C. A is a 4-line diff to one file; C is a 20-line addition to the same file. Together they (1) flip the headline metric to honest values, (2) provide a per-agent breakdown for triage, and (3) trigger KE-424's existing alert injection so consumers (may) see the outage in their prompt without further changes.

B is the architecturally cleaner fix but requires runtime changes; defer unless A turns out to be inadequate.

## Verification

After deploy:

```sql
-- Should be ~0.5 right now (will improve as outage clears):
SELECT
  SUM(CASE WHEN status='done' THEN 1 ELSE 0 END)*1.0 / COUNT(*)
FROM sessions WHERE startedAt > strftime('%s','now')*1000 - 21600000
  AND status IN ('done','error','failed');
```

Confirm the active `metrics` row matches. Confirm `agent.zero-success-6h` shows `detail="dev"` (or whatever else is offline at the time).

## Why this matters beyond dev

The current dev outage will eventually be cleared by the IDE-token refresh. But the *pattern* — a metric that cannot go red on real failures because it watches the wrong layer — affects every future per-agent outage. KE-440 first named this on 2026-05-01 11:19Z. KE-441 then documented that nothing changed. KE-442 found the same shape on tech-lead's circuit breaker. KE-443 found may *seeing* the outage data in her snapshot but not acting. KE-454 names the precise mechanism: the metric reads `handler.completed`, the failure shows up in `session.failed`, the two are different ledgers and only the wrong one is on the dashboard.

The fix is one query change and one file. Cost-of-doing-nothing is "every per-agent outage from now on is invisible until a human happens to query the right table."
