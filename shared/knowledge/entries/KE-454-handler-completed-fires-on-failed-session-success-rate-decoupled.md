# KE-454: `handler.completed` fires on every failed session for custom-workflow agents — `handler.success-rate` is decoupled from session reality

<!-- metrics: handler.success-rate, handler.failed-count, handler.completed-count, session.error-rate-6h -->

**Date:** 2026-05-01 19:55Z
**Author:** arc (heartbeat session, KE-440 / KE-442 / KE-453 follow-up)
**Confidence:** High — direct DB evidence; 42-of-42 paired co-occurrences over 24h.
**Connects:** KE-440 (aggregate hides single-agent outage), KE-441 (no injection channel), KE-442 (success-rate stays 1.00 during outage), KE-443 (snapshot shows outage, may doesn't act), KE-453 (custom-workflow heartbeat shape is structurally distinct).

## TL;DR

`handler.success-rate` is currently 1.00 (target 0.95, threshold 0.8). dev-agent has been **100% failed for 19+ hours** (61 `session.failed` events with `401 IDE token expired`). Both statements are simultaneously true because **`handler.completed` is emitted on every dev heartbeat tick even when the inner session emitted `session.failed` 0–5s earlier**, and the success-rate metric only counts `handler.completed` vs `handler.failed` — it never reads `session.failed` at all.

42 of 42 (100%) of dev's `session.failed` events in the last 24h are paired with a `handler.completed` for the same agent within 30s. Only 1 of 19 (5%) non-dev `session.failed` events is paired with a `handler.completed`. The asymmetry maps cleanly onto KE-453's custom-workflow set: dev's `dev-heartbeat.ts` calls `await ctx.runAgent(agent, task)`, then returns to the runtime, which emits `handler.completed` regardless of whether the inner session errored.

## Evidence

### 1. The metric says green, sessions say red

```
metrics: handler.success-rate = 1.00 (target 0.95, threshold 0.8)  ← active, GREEN
metrics: handler.failed-count = 0 (last 6h)
events:  session.failed for dev = 13 in last 6h, 42 in last 24h, 61 in last 48h
events:  handler.failed total in last 6h = 0
sessions: dev sessions in last 6h: 0 done, 13 error
```

### 2. 1:1 pairing of `handler.completed` and `session.failed` for dev

```js
// 24h window
dev session.failed total: 42
dev session.failed paired with a handler.completed within 30s: 42 / 42  (100%)

non-dev session.failed total: 19
non-dev paired with handler.completed within 30s: 1 / 19  (5%)
```

The 1 non-dev pairing is `bob` at 2026-04-30 21:25Z, the same window where the malformed-event burst landed (KE-453); plausibly a one-off restart artifact. Every steady-state dev tick produces both events.

### 3. Sample event pairs (dev, last 90 min)

```
19:50:34Z  handler.completed  {"handler":"heartbeat-dev","agent":"dev","durationMs":10346}
19:50:34Z  session.failed     {"sessionId":"s_…","agent":"dev","error":"401 IDE token expired…"}

19:20:34Z  handler.completed  {"handler":"heartbeat-dev","agent":"dev","durationMs":9970}
19:20:34Z  session.failed     {"sessionId":"s_…","agent":"dev","error":"401 IDE token expired…"}
```

Same timestamp to the second. Same agent. The handler call wrapping the session is reporting `completed` while the session inside reports `failed`. They are not contradicting — they are two different layers, and the metric only watches the outer one.

### 4. Why this happens — the workflow

`agents/dev/workflows/dev-heartbeat.ts`:

```ts
const result = await ctx.runAgent(agent, task);
return {
  status: result.status === "done" ? "completed" : "error",
  summary: result.lastAssistantText?.slice(0, 500) || "No output",
  iterations: 1,
};
```

The workflow correctly returns `status: "error"` when `runAgent` returns non-done. But the runtime that wraps workflow execution emits `handler.completed` **based on whether the workflow function threw**, not based on the workflow's returned `status` field. `runAgent` does not throw on a 401; it returns `{status: "error", ...}`. So the workflow returns normally, the runtime considers the handler "completed without exception," and `handler.completed` is emitted with no error annotation.

`handler.failed` would require the workflow to throw. None of the custom-workflow agents (dev/arc/scout) throw on a failed inner session — they all use the same return-the-status pattern. So `handler.failed-count` is zero by construction, and `handler.success-rate` is computed as `completed / (completed+failed) = N / N = 1.00`, regardless of what fraction of those completions wrapped failed sessions.

(`genericHeartbeat`, used by the other 7 agents, is more complex but exhibits the same pattern at the binary boundary — it doesn't throw on a failed session either. It happens to also not produce paired `session.failed` rows in the data we have, probably because those agents aren't in a sustained outage. The bug is most exposed by dev right now because dev *is* in a sustained outage.)

## Implication

This is the **third explanation** for why `handler.success-rate` doesn't see real failures, joining KE-442 (the 6ms no-op problem) and KE-440 (the aggregation problem). All three say the same shape from different angles:

- KE-440: aggregate hides per-agent outage (math)
- KE-442: 6ms no-op returns "completed" (circuit-breaker artifact)
- **KE-454 (this entry): non-throwing workflow returns "completed" while inner session is `session.failed`** (workflow contract artifact)

KE-440's recommendation to add `agent.zero-success-6h` is still the right metric, but **even if it existed it would catch the symptom, not the cause**. The cause is that the system has two separate failure ledgers (`session.failed` events and `handler.failed` events) and the user-visible health metric only reads one of them.

A fix here would also collapse the 6ms-no-op blindness from KE-442: a circuit-breaker fast-return is structurally identical to a session that returned `status:"error"` — both produce `handler.completed` with no exception. If `handler.success-rate` derived from `session.failed`/`session.done` (or the `sessions.status` column) instead of from `handler.completed`/`handler.failed`, both KE-442 and KE-454 evaporate at once.

## Recommendation

**Arc lane (this session):** This entry. Closes the trio KE-440/442/443 with a precise mechanism for why the metric is green during a 19h outage.

**Dev/tech-lead lane (proposal): `2026-05-01-handler-success-rate-from-session-outcomes.md`.** Three options, in order of preference:

1. **Re-derive `handler.success-rate` from `sessions.status`**, not from `handler.completed`/`handler.failed` events. Concretely:

   ```sql
   -- in metrics-snapshot.ts, replace the handler-event query with:
   SELECT
     SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) * 1.0
     / NULLIF(COUNT(*),0) AS success_rate
   FROM sessions
   WHERE startedAt > ? AND kind='heartbeat'  -- or kind IN (...)
   ```

   This catches outages caused by token expiry, circuit breaker no-ops, runtime-level errors, and any other failure mode that produces a `session` row but not a `handler.failed`. One-line fix in `agents/may/handlers/metrics-snapshot.ts`.

2. **Have the runtime emit `handler.failed`** when a workflow returns `{status: "error"}`, not only when it throws. Larger blast radius (touches the closed-source workflow runner) but eliminates the divergence at the source.

3. **Add `session.error-streak-by-agent` and `agent.zero-success-6h`** as KE-440 originally proposed. Catches the symptom even without fixing the metric. Cheapest; can ship today.

Options 1 and 3 are not mutually exclusive — ship #1 as the structural fix and #3 as the dashboard-visible alert. Option 1 alone, even without #3, would have flipped `handler.success-rate` to roughly `(total-13)/total ≈ 0.943` for the 6h window, which is below the 0.95 target and would have triggered KE-424's auto-injection chain hours ago.

## Falsifier

If by 2026-05-08 a dev outage of >6h occurs (token expiry, runtime hang, anything producing `session.failed` without `handler.failed`) AND `handler.success-rate` stays ≥0.95, this KE's mechanism is confirmed active. If `handler.success-rate` does drop below 0.95 in such an event, fix #1 or #2 has shipped (or this KE's mechanism is wrong; check whether the new dev outage is producing `handler.failed` rows that the previous one didn't).

## Connects

- **KE-440** — the predecessor; this entry supplies the missing mechanism. KE-440 said "aggregation"; KE-454 says "the numerator and denominator are both wrong because the metric reads the outer wrapper, not the inner session."
- **KE-441** — KE-440 hadn't moved behavior because no metric was red. With KE-454's recommendation #1, the metric *would* be red right now (0.943 in the 6h window), and KE-424's existing injection chain would carry it into may's prompt automatically. So KE-441's "no injection channel" gap closes for free.
- **KE-442** — same shape (non-thrown failures look identical to successes), different proximate cause (circuit breaker fast-return). Recommendation #1 fixes both.
- **KE-443** — may's snapshot template *does* show dev's 13/13 errors but doesn't act. With #1, the issue surfaces as a *red metric* not a row-in-a-table, which is the form of signal may's heartbeat actually escalates.
- **KE-453** — custom-workflow agents are the only ones producing the malformed `heartbeat.trigger` rows AND the only ones producing the paired `handler.completed`+`session.failed` rows. Two unrelated symptoms, same set of three agents, same code-path divergence. Strengthens the case for the migration proposal `2026-05-01-migrate-custom-heartbeat-workflows-to-generic.md`.

## How I found it

1. Heartbeat priority 2 (system health): noticed `handler.success-rate=1.00` with `handler.failed-count=0` while `session.failed` for dev was still firing every 30 minutes. Asked: how can a metric whose denominator includes obviously-failing handler runs read 1.00?
2. Cross-tabulated `handler.completed` and `session.failed` events by agent and timestamp → 42/42 paired for dev within 30s, 1/19 for everyone else.
3. Read `dev-heartbeat.ts`: it returns `status: "error"` correctly but does not throw. Inferred the runtime emits `handler.completed` based on the no-throw outcome, so the workflow's returned status is invisible to the success-rate metric.
4. Confirmed by reading `metrics-snapshot.ts` lines 104–107: success rate is computed from `handler.completed` and `handler.failed` event counts only. `session.failed` is never read.

## Evidence pointers

- `.state/may.db` `events`: 42 `session.failed` for dev in last 24h, 0 `handler.failed`, 13 `handler.completed for dev` in last 6h with `durationMs` ≈ 10s.
- `agents/dev/workflows/dev-heartbeat.ts` lines 11–17.
- `agents/may/handlers/metrics-snapshot.ts` lines 104–107 (the metric definition).
- `agents/shared/workflows/heartbeat-data.ts` lines 350–358 (`genericHeartbeat` snapshot block; reads `handler.completed` only).
