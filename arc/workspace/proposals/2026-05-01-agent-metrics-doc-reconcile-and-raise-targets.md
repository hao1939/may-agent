# Proposal: Reconcile agent-metrics.md with live metrics table; raise or graduate the 7 overshooting targets

**Date:** 2026-05-01
**Author:** arc
**Status:** open; for may / Hao decision
**Connects:** KE-452, KE-434 (doc-runtime drift family)

## Problem

`agents/shared/may-agent-docs/design/agent-metrics.md` is the canonical doc for "is the system healthy and producing?" It lists **6** system metrics. The live `metrics` table has **14** active metrics under the same four prefixes (`handler.*`, `system.*`, `project.*`, `session.*`).

Concretely, these 8 metrics are active in the DB but absent from the design doc:

```
handler.completed-count        target 50    current 225
handler.failed-count           target 0     current 0
handler.fires-per-hour         target 30    current 38   (red)
handler.p95-duration           target 120000 current 139518 (red)
project.active-count           target 3     current 2
project.blocked-count          target 2     current 2
project.blocked-rate-7d        target 0.1   current 0
project.stale-active-count     target 0     current 1
```

Two of those (`handler.fires-per-hour`, `handler.p95-duration`) are currently breaching their targets — i.e., real signals operators would only learn about by reading the `metric_alerts` table, not the design doc.

Independently, the doc's own Metric Lifecycle prescribes "Raise target — target met consistently? Raise the bar or add dimensions." Seven metrics are met-or-overshot:

| metric | target | current | suggested action |
|---|---|---|---|
| `system.real-output-24h` | 100 | 1781 | raise to 1000; "100 real outputs/24h" was a struggling-system target |
| `project.iterations-24h` | 10 | 673 | raise to 200, *or* graduate (this metric mostly tracks dispatch volume, not project advancement — see KE-432, 437, 447) |
| `handler.completed-count` | 50 | 225 | raise to 150 |
| `handler.success-rate` | 0.95 | 1.0 | hold; this is a quality floor, not a target to raise |
| `session.error-rate-6h` | 0.10 | 0.0199 | hold (floor); consider lowering to 0.05 |
| `project.blocked-over-6h` | 2 | 0 | hold (floor); already a "0 is best" metric — current target=2 is misleading, set target=0 |
| `handler.heartbeat-coverage` | 8 | 8 | hold or raise to 9 once a 9th agent is active |

`project.blocked-over-6h` deserves special note: target=2 with current=0 reads as "we tolerate 2 blocked projects." The doc text in the same row says target=0 — so the doc and the DB *disagree on the target*, not just on the metric set.

## Evidence

- `bun -e "..." SELECT id, current, target, threshold FROM metrics WHERE status='active' AND ...` — 14 active rows (KE-452 includes the full list).
- `agents/shared/may-agent-docs/design/agent-metrics.md` line 17: "6 metrics. 3 infrastructure + 3 output."
- `agents/shared/may-agent-docs/design/agent-metrics.md` line 27 says `project.blocked-over-6h` target is **0**; DB row says target **2**.
- `git log -- shared/may-agent-docs/design/agent-metrics.md` shows the doc has oscillated 6 ↔ 8 metric counts across at least three revisions without ever matching the DB.
- `metric_alerts` (handler `metric-alert-reactor`) is the only place an operator currently learns about `handler.p95-duration` breaches — the design doc is silent on this metric.

## Proposed change

Two coupled actions, owned by may:

**A. Reconcile the doc to match the DB (or vice versa).**
- Decide whether each of the 8 missing metrics belongs in the canonical "system health" set.
- If yes → add to the table in `agent-metrics.md`.
- If no → set `status='retired'` in the DB and remove its measurement from `metrics-snapshot.ts`.
- Fix the `project.blocked-over-6h` target mismatch: pick 0 (doc) or 2 (DB) and align.

**B. Run lifecycle step 4 or 5 on the 7 met-or-overshot metrics.**
- For each metric in the table above, either raise the target by ≥3× or graduate to watch-only (per the doc's own step 5, which requires human approval — i.e., this proposal *is* the request).
- Suggested concrete updates listed in the table above; may may revise.

## Expected impact

- A heartbeat reader who follows the design doc gets the actual breach surface, not 43% of it.
- Targets become meaningful again: a green metric in the snapshot will mean "above the current bar," not "above a bar we set 6 weeks ago when the system was struggling."
- Closes a long-running case of doc-runtime drift in the same family as KE-434 and KE-452.

## Risks

- **Ratchet trap.** Raising targets too aggressively flips green → red on metrics that aren't actionable, creating alert fatigue. Mitigation: raise to ~½ the current value (still a stretch but achievable), not to current; revisit in 30 days.
- **Premature retirement.** Removing `project.iterations-24h` because it overshoots ignores that the overshoot includes pathological dispatch-loop iterations (KE-432 et al). Better to *split* into `project.iterations-real` (counts only iterations that produced commits) than to retire. Defer split to a follow-up project.
- **Coupled change.** Reconciling the doc and raising targets in one PR mixes editorial and policy changes. Acceptable here because both are owned by may; if Hao prefers, split into two commits.

## Decision needed

Hao or may to choose:
1. Adopt A and B as proposed.
2. Adopt A only (reconcile doc, leave targets).
3. Adopt B only (raise targets, doc stays stale — not recommended; KE-452 will recur).
4. Reject (then update the doc to drop the lifecycle-step-4 language so the doc and behavior agree).
