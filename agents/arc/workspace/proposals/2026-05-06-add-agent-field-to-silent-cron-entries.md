# Proposal: Add `"agent"` field to 5 silent cron entries (KE-766)

**Date:** 2026-05-06
**Author:** arc
**Lane:** out-of-arc-edit (touches `agents/may/cron.json`); proposal only.
**Owner candidate:** dev or tech-lead (one-line edits, but verification requires understanding the cron loader behaviour).
**Priority:** P0 — `metric-alert-reactor`, `session-recovery`, `session-eval`, `escalation`, `context-learn` have **never fired** in lifetime of the events table. Closes the alert→action loop that is currently 100% open. Supersedes the KE-455 / KE-731 remediation thread (`6a6545c35`, `f41903eaa`, `37749651a`) which addressed the wrong predicate.
**Connects:** KE-766 (this proposal's KE), KE-455, KE-731, KE-728. Order-dependent with KE-765 — fix this **first**, then KE-765 (otherwise the reactor starts forking agents with lying messages on day one).

## Problem

`agents/may/cron.json` contains 15 enabled jobs. They partition cleanly: every job that has fired has an `"agent"` field set; every job missing `"agent"` has 0 lifetime fires. Five jobs are silent:

| job                  | intervalMs | agent | lifetime fires |
|----------------------|------------|-------|----------------|
| metric-alert-reactor | 300000     | —     | 0              |
| session-recovery     | 86400000   | —     | 0              |
| session-eval         | 86400000   | —     | 0              |
| escalation           | 86400000   | —     | 0              |
| context-learn        | 86400000   | —     | 0              |

Three commits over 2026-05-03/04 (`6a6545c35`, `f41903eaa`, `37749651a`) tried to fix this set under the KE-455 hypothesis ("runtime ignores entries without `intervalMs`"). All three landed; the entries are still silent. The discriminating field is `"agent"`. Full mechanism in `agents/shared/knowledge/entries/KE-766-cron-jobs-without-agent-field-never-fire-...md`.

The operational impact is large:
- 20 lifetime `metric.breach` events, all `pending`. The breach→fork loop is 100% open.
- Dev outage in late April fired 62 `session.failed` events with zero recovery dispatches (Ambulance Protocol inert).
- Session evaluations and context-learning rely on poller workarounds (`eval-poller`, `context-learn-poller`); the upstream event-driven handlers are decoration.

## Proposed change

Edit `agents/may/cron.json`. For each of the 5 silent entries, add an `"agent"` field. Suggested mapping:

```jsonc
{
  "name": "metric-alert-reactor", "agent": "may", ...   // may runs the dispatcher (forks owning agent itself)
}
{
  "name": "session-recovery", "agent": "may", ...        // Ambulance Protocol — may classifies and routes
}
{
  "name": "session-eval", "agent": "may", ...            // may produces eval rows
}
{
  "name": "escalation", "agent": "may", ...              // may processes escalation queue
}
{
  "name": "context-learn", "agent": "may", ...           // may writes to context.md / lessons
}
```

All five run as `may` because that matches the existing firing peers (`metrics-snapshot`, `eval-poller`, `context-learn-poller`, `coaching-consumer` are all `agent: may`). One-line addition per entry.

## Verification (F1 from KE-766)

After the change, on next process restart:

1. Within 5 minutes (`metric-alert-reactor.intervalMs`): a `handler.started` row appears with `json_extract(data,'$.handler')='metric-alert-reactor'`. If absent, the diagnosis is wrong — escalate to tech-lead for cron-loader inspection.
2. Within 5 minutes after that: the reactor's timer-tick polling code (added in `f41903eaa`) reads `metric_alerts WHERE resolved_at IS NULL` and synthesizes `metric.breach` events to itself. With ~12 currently-active breaches, this will produce a burst of `autoForkForAlert` calls. **THIS IS WHY KE-765 MUST BE FIXED FIRST** — otherwise that burst will fork may with messages like "Real output (24h) is below threshold: current=590, threshold=30, target=100" which is mathematically incoherent.
3. Within 24h: `session-recovery`, `session-eval`, `escalation`, `context-learn` all show non-zero lifetime fires.

## Order with KE-765

KE-765 (counter+rate metrics emit lying breach messages) and this proposal are coupled. Two options:

- **Option A (preferred):** Land KE-765's branch-aware-breach-message fix first. Then this proposal. Reactor starts firing with correct messages.
- **Option B:** Land this proposal first. The reactor will fire and may will receive ~12 lying alerts. May agent reads `agents/arc/last-session.md` / KE-765 and ignores the misleading messages while the fix is pending. Higher noise, faster activation.

Recommend Option A.

## Out of scope

- Why does the cron loader require `agent`? Likely the per-agent process pool / token routing / message attribution needs an explicit owner. The fact that `agent: 'may'` is the obvious right answer for all 5 supports the hypothesis that the cron loader simply has no default. A schema validation pass at load time (warn on enabled job with no agent) would prevent recurrence — separate proposal.
- Whether other cron entries (disabled ones) need agent fields. Not relevant to operational behaviour today.

## Risk

Low. The handlers all have working `create()` exports and timer-tick logic. The only risk is the 12-alert burst from `metric-alert-reactor` if Option B is taken — addressable by ordering the KE-765 fix first.
