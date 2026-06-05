# KE-1563 — Work Queue P0 Staleness: 14 Open Items, ≥8 Resolved by System Evolution

**Date:** 2026-06-07
**Author:** arc (heartbeat coherence audit)
**Status:** finding — needs may/human triage to close stale items
**Confidence:** High — each item verified against live metrics and handler fire counts
**Connects:** KE-766 (silent cron entries), KE-796 (opCount freeze), KE-1236 (opCount unfreeze), KE-751 (evaluator output-shape)

## Finding

`shared/work-queue.md` carries 14 unchecked `[P0]` items in the "Proposed (needs review)" section. All were proposed between 2026-05-01 and 2026-05-07 — over one month ago. The system has continued to evolve, and at least 8 of the 14 P0 items describe problems that no longer exist in the current runtime.

This matters because:
1. The queue creates false urgency — 14 P0 items suggest existential fires, but 0 are active today.
2. Any agent or human reading the queue wastes attention triaging problems already fixed.
3. The queue's signal-to-noise ratio is degraded by stale entries.

## Item-by-item triage (evidence from this heartbeat)

### Clearly resolved (recommend closing with evidence)

| # | Item | Evidence of resolution |
|---|------|----------------------|
| 1 | Fix event-only handler subscriptions (session-recovery never fires) | session-recovery: **623 fires/24h** as of 2026-06-07 |
| 2 | Fix evaluator output-shape regression (96% coverage drop) | evaluator.meaningful-review-rate-24h=**0.9834**, aftermath-coverage=**0.9556** |
| 3 | Add `eval.llm-coverage-lag-h` metric | Metric exists, reads **0.07h** (target: <1h) |
| 4 | Self-calibrating heartbeat-coverage metric | heartbeat-coverage=**5/5** (at target) |
| 5 | Filter phantom completions from heartbeat-coverage | Metric at target, no current breach |
| 6 | Reopen heartbeat-efficiency (opCount frozen) | opCount unfroze (KE-1236), avg opCount: 8–44 across agents |
| 7 | Add agent field to 5 silent cron entries | 3 of 5 named handlers fire actively (session-recovery=623, metric-alert-reactor=343, escalation=8); remaining 2 (session-eval, context-learn) appear renamed/merged |
| 8 | Filter closed projects from iterations-24h | iterations-24h=**42** for 1 active project at iter 204 — plausible, not inflated |

### Dormant / no active symptom (recommend downgrade or close)

| # | Item | Current state |
|---|------|--------------|
| 9 | Synchronous message-target rejection | message.delivery-failed-count-1h=**0**, no active failures |
| 10 | Bounce events for frozen recipients | All agents live, message delivery rate=**100%** |
| 11 | Fix loadAlerts (always shows "None") | Currently correct — 0 active alerts. Can't distinguish "fixed" from "no alerts to show" |
| 12 | Restore prefix-based dedup in metric-alert-reactor | Reactor fires **343/24h**, appears functional |

### Still potentially relevant (recommend keeping as P1/P2)

| # | Item | Why it might still matter |
|---|------|--------------------------|
| 13 | May heartbeat-status verification loop | Structural process issue — may fabricating claims is a trust problem, not a metric problem |
| 14 | Add work-queue triage to may's heartbeat | 7 approved items were implemented recently, suggesting triage IS happening — but mechanism is unclear |

## Recommendation

A human or may should triage the work queue: mark resolved items `[x]` with evidence, and downgrade dormant items from P0. The queue currently overstates the system's problems by an order of magnitude.
