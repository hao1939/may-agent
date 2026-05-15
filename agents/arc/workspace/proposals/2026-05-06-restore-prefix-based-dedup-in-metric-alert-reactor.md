# Proposal: Re-apply cad130ff5 — restore prefix-based dedup in `metric-alert-reactor`

## Problem

The `metric-alert-reactor`'s dedup check at `agents/may/handlers/metric-alert-reactor.ts:89` uses `task LIKE %${metricId}%`. This matches every may heartbeat session because may's heartbeat task includes a `loadMetrics()`-injected block that lists every metric ID by name (e.g. `📊 handler.completed-count: 191 …`). With 8 may-owned metrics and 8 may heartbeats per 4h dedup window, every breach for every metric is dedup-eaten — the reactor forks zero times, regardless of whether the cron arm or the event arm dispatched it.

This is the exact bug commit `cad130ff5` ("fix: metric-alert-reactor dedup was matching heartbeat sessions, never forking", 2026-04-23 07:41Z) fixed by changing the LIKE pattern to the prefix `[metric-alert][${metricId}]%` (the prefix of the task the reactor itself generates). Ten hours later, commit `83d2410d3` ("bob: commit remaining lab changes", 2026-04-23 18:02Z) bundled a multi-file lab dump that silently reverted that one line back to `%${metricId}%`. No commit message acknowledged the revert; no KE noticed it (KE-729 cited the commit but read it as a no-op).

KE-776 has the full evidence + simulation. Live data (this session, 2026-05-06 23:25Z): all 8 may-owned metrics dedup-match 8/8 may sessions in the last 4h. Reactor lifetime fork count: 0. Pending `metric.breach` events in last 24h: 34 (all `status='pending'`, `handled_by=NULL`).

## Evidence

- KE-776 (this session) — full diff history, mechanism, simulation
- KE-728 (reactor import-broken; the *first* of the cascading reactor bugs)
- KE-729 (post-import-fix wedge; nobody saw the dedup re-break beneath it)
- KE-766 (silent cron `agent` field — independent; landing it without this fix still leaves dedup blocking)

## Proposed Change

One-line diff in `agents/may/handlers/metric-alert-reactor.ts`:

```diff
       const recentSession = db.prepare(
         `SELECT sessionId FROM sessions
          WHERE agent = ? AND task LIKE ? AND startedAt > ?`
-      ).get(owner, `%${metricId}%`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;
+      ).get(owner, `[metric-alert][${metricId}]%`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;
```

Plus a regression test asserting the LIKE parameter for the dedup query is the prefix form, not the substring form. The lab-dump revert pattern (KE-450/451/774 family) is recurrent; only a test catches it next time.

## Expected Impact

- Reactor fork count goes from 0 → ≥1 within one snapshot cycle (5 min) once a fresh `metric.breach` is emitted (or the timer arm runs over an open alert, *if* KE-766 also lands).
- May begins receiving `[metric-alert][...]` forks for breaches and follows the three-option remediation prompt at the bottom of `metric-alert-reactor.ts`. This is the "alert → owner reacts" loop closing for the first time.
- Resolves the dedup half of the two-suppressor stack identified in KE-776. KE-766 must also land for the **timer arm** to ever wake; this fix unblocks the **event arm** independently.
- Reduces per-breach workload on may-as-self-monitor: today may sees the alerts only via the lying heartbeat header (KE-770). After this fix, the alert arrives as an explicit fork with a clear three-option task, the way the system was designed.

## Risks

- **Re-fork storm if the dedup window is too tight.** Current `DEDUP_WINDOW_MS = 4h`. If breaches re-open every snapshot (KE-774's flap pattern), the reactor will fork once per *new* alert row, not once per *snapshot tick*, because `processBreachEvent` only runs on event delivery (event arm) or on still-unresolved rows (timer arm dedup'd by reactor's own task prefix). Should be self-limiting — but worth monitoring.
- **Stacked with KE-774 (rate-mode flap):** every flap on the windowed-counter metrics will produce a fork. With 16 flaps/24h on `handler.completed-count` alone, this could be 16+ forks/day on a single metric. Recommend landing KE-774 (drop rate mode) **before or alongside** this fix to keep per-day fork count sane.
- **Stacked with KE-765 + KE-770 + KE-775:** the prompt may sees will still contain a lying message ("current=N below threshold=T" when N>T) and will still arrive after a heartbeat header that says "All metrics healthy." May has been *correctly dismissing* these as known-bug noise (KE-771). Forking her now without first landing KE-765/770 will retrain her to dismiss the new fork too.

**Recommended sequence:**

1. KE-774 fix (drop rate mode from windowed-counter metrics) — stop the flap.
2. KE-770 fix (header consults `metric_alerts`) — stop the lying header.
3. KE-765 + KE-775 fix (branch-aware message + correct alert_type stamp) — stop the lying message.
4. **THIS fix** (restore prefix-based dedup) + KE-766 fix (silent cron agent field) — re-open the actual fork channel into a now-truthful prompt.

Landing this fix *first*, before the message/header fixes, would cause may to be forked into a known-incoherent prompt 16+ times per day. May would dismiss them; the fork channel would become its own noise source. The whole stack needs landing in order — but the order is now defined and the chokepoint files are identified.

## Lane

`agents/may/handlers/metric-alert-reactor.ts` is **out of arc's edit lane** (KE-450/451). This proposal is the action; the patch must be applied by dev or may.

## Tests

Add to `agents/test/` or `agents/shared/tests/`:

```ts
// dedup must use the prefix [metric-alert][${metricId}] not the substring %${metricId}%
test("metric-alert-reactor dedup uses [metric-alert] prefix not substring", async () => {
  // Setup: insert a may session whose task contains 'handler.completed-count'
  // (mimicking the heartbeat injection)
  db.run("INSERT INTO sessions (...) VALUES ('s_test', 'may', '... 📊 handler.completed-count: 191 ...', ...)");
  // Trigger a metric.breach for handler.completed-count
  // Assert: ctx.manager.callAgent was called (i.e., dedup did NOT skip)
});
```

The test would have failed at `83d2410d3` and prevented the silent revert.
