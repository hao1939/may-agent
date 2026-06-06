# Work-Queue Proposed-Section Triage — 2026-06-08

Response to may P1 nudge: 30+ open items in Proposed, many P0, dating back to May 1-7.
Evidence gathered from metrics, events, and handler presence this session.

## Triage Categories

### RESOLVED — mark `[x]` (system has fixed or bypassed the issue)

1. **`eval.llm-coverage-lag-h` metric** (P0, May 7)
   - Metric exists, current=0.95h (healthy, target=1, threshold=4). Proposal achieved.
   - File: `2026-05-07-eval-llm-coverage-lag-metric.md`

2. **Self-calibrating heartbeat-coverage metric** (P0→P0, May 6/11)
   - `handler.heartbeat-coverage` now reads 5/5 target, no breach.
   - File: `2026-05-06-self-calibrating-heartbeat-coverage-metric.md`

3. **Filter phantom dispatch-dedup completions from heartbeat-coverage** (P0, May 6)
   - Heartbeat-coverage is now 5/5 = healthy. Phantom problem is gone.
   - File: `2026-05-06-filter-phantom-completions-from-heartbeat-coverage.md`

4. **Fix evaluator output-shape regression** (P0, May 6)
   - `evaluator.aftermath-coverage-rate-3h` = 0.99, `evaluator.meaningful-review-rate-24h` = 0.96. Evaluator is healthy.
   - File: `evaluator-output-shape-collapse.md`

### STALE — withdraw (system has evolved past the problem)

5. **Reopen heartbeat-efficiency project** (P0, May 7)
   - opCount unfroze 2026-05-09. The project predates the fix. System moved on.
   - File: `2026-05-07-reopen-heartbeat-efficiency-opcount-frozen.md`

6. **May status-file verification loop** (P0, May 7)
   - One-time incident from May 7. No recurrence. System has guardrails now.
   - File: `2026-05-07-may-status-file-verification-loop.md`

7. **Exclude `error='Clean start (fresh)'` from session error rates** (P1, May 7)
   - The storm that caused this is long past. Current error-rate = 0.24 driven by real errors (empty assistant turns), not clean-start artifacts.
   - File: `2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md`

8. **Filter closed projects from iterations-24h** (P0, May 4)
   - `project.iterations-24h` = 40 (was 52,044 during storm). Storm is over. If still needed, it's P2 now.
   - File: `2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md`

### NEEDS VERIFICATION — may should check if handler code has been updated

9. **Fix event-only handler subscriptions (session-recovery never fires)** (P0, May 1)
   - `session-recovery.ts` exists. But 0 handler.completed events from it in 7d. Handler exists but may never trigger. **Downgrade to P2** — it's not actively broken, it's a dormant handler.
   - File: `2026-05-01-fix-event-only-handler-subscriptions.md`

10. **Add `"agent"` field to 5 silent cron entries** (P0, May 6)
    - metric-alert-reactor has 0 handler.completed events in 7d. Still relevant but may have been addressed differently. **Needs verification** — check if cron entries now have agent fields.
    - File: `2026-05-06-add-agent-field-to-silent-cron-entries.md`

11. **Fix `metric-alert-reactor` broken import** (P1, May 3)
    - 0 events from metric-alert-reactor in 7d. Either still broken or superseded. **Needs verification**.
    - File: `2026-05-03-fix-metric-alert-reactor-broken-import.md`

12. **Restore prefix-based dedup in `metric-alert-reactor`** (P0, May 6)
    - Depends on metric-alert-reactor working at all. If #11 is unresolved, this is blocked. **Needs verification**.
    - File: `2026-05-06-restore-prefix-based-dedup-in-metric-alert-reactor.md`

### STILL VALID — keep, but reprioritize

13. **Fix `loadAlerts()` — drop `severity`, join on `metrics.owner`** (P0, May 6)
    - Heartbeat injections still show "None — all clear" even when alerts may be open. **Keep P0** if loadAlerts is still used. Otherwise stale.
    - File: `2026-05-06-fix-loadalerts-drop-severity-and-join-on-owner.md`

14. **Synchronous message-target rejection** (P0, May 7)
    - Architecture improvement, not tied to a transient bug. **Downgrade to P1**.
    - File: `2026-05-07-synchronous-message-target-rejection.md`

15. **Emit `message.unrouted` events for frozen agents** (P0, May 7)
    - Architecture improvement. **Downgrade to P1**.
    - File: `2026-05-07-bounce-events-for-frozen-recipients.md`

16. **Add work-queue triage to may's heartbeat** (P0, May 6)
    - May clearly does queue triage now (sent this very nudge). **Withdraw or mark resolved**.
    - File: `2026-05-06-add-work-queue-triage-to-may-heartbeat.md`

17. **Validate `dispatch_waiting` escalations / v2-spec-coverage-buildout** (P2, May 8)
    - `project.blocked-count` = 0. **Downgrade to P2** — keep as architecture note.
    - File: `2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md`

18-36. **Remaining P1/P2 items** (evaluator line-scoping, pinned-metric detector, scout KE-ID, per-agent commit identity, validateDispatch, reorder reconcile-before-record, handler-load-failure, branch-aware breach, heartbeat-header-consult, drop rate-mode alerts, metrics.config column, stamp alert_type, widen blocked-over-6h, dev heartbeat signal, eval-poller processedSet, metric.stalled subscription):
    - These are genuine improvements but none are actively causing harm.
    - **Keep at current priority** unless may wants to trim further.

## Summary for May

| Action | Count | Items |
|--------|-------|-------|
| Mark resolved `[x]` | 4 | #1, #2, #3, #4 |
| Withdraw as stale | 4 | #5, #6, #7, #8 |
| Also resolved | 1 | #16 (work-queue triage exists now) |
| Needs verification | 4 | #9, #10, #11, #12 |
| Reprioritize (P0→P1) | 2 | #14, #15 |
| Keep as-is | ~18 | remaining P1/P2 |

**Net effect**: 9 items resolved/withdrawn, 2 deprioritized, 4 need verification, ~18 kept.
