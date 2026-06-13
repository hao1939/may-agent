# Iteration 9 — Remaining 5 Claims Analysis

**Current coverage:** 17/22 = 0.7727  
**Target:** Push to 22/22 = 1.0  
**Date:** 2026-05-09

## Uncovered Claims

### C2 — Self-healing (FEASIBLE — data exists)

**Metric:** `capability.breach-time-to-recovery-p50-h`  
**Data available:** 11,626 `metric.breach` events + 31,432 `metric.recovered` events with `metricId` in JSON `data` field.  
**Implementation:** Join breach→recovery by `metricId` and `timestamp` ordering. For each breach, find the next recovery of the same metric. Compute median delta in hours.  
**Supporting metric:** `capability.unrecovered-breach-count-7d` — breaches with no matching recovery within 7 days.  
**Effort:** ~30 lines of SQL + aggregation. Low risk.

### C3 — Memory and continuity (FEASIBLE with caveats)

**Metric:** `capability.journal-reference-rate`  
**Data available:** 241 `agent.decision` events. Journal files in `agents/*/journal/`.  
**Implementation:** For each agent.decision event, check if its `data` text references a prior journal date or content phrase. Divide by total heartbeat sessions where a journal exists.  
**Caveat:** Low `agent.decision` emission (241 events vs thousands of heartbeats). The metric will measure a small sample. Spec already notes this depends on S7 improvement.  
**Effort:** ~40 lines. Medium risk (text matching heuristics).

### C4 — Coordination (FEASIBLE but semantically questionable)

**Metric:** `capability.message-conversation-close-rate`  
**Data available:** 85,550 `message.created` events.  
**Implementation:** For each message, check if a reply/ack message exists from the receiver within 3 heartbeats. Compute close rate.  
**Caveat:** Spec status says "violated by usage pattern, not by mechanism" — agents use stigmergic coordination (shared files) not messages. Measuring this metric is technically possible but may not reflect actual coordination quality. The spec suggests adding `capability.cross-agent-file-reference-rate` as an alternative.  
**Recommendation:** Implement the metric as-is (it will likely show high close rate since messages that ARE sent do get handled). Flag as "measured but semantically incomplete" in spec.  
**Effort:** ~50 lines. Medium risk.

### C5 — Ownership (FEASIBLE — data exists)

**Metric:** `capability.cross-domain-handling-rate`  
**Data available:** `metric.breach` events have `owner` in data. Sessions table has agent info.  
**Implementation:** For each breach event, find the remediation session (forked by metric-alert-reactor). Check if the session's agent matches the metric's owner. Rate = mismatches / total.  
**Effort:** ~30 lines. Low risk.

### C6 — Adaptation (FEASIBLE — depends on snapshot history)

**Metric:** `capability.trend-7d`  
**Data available:** `metric_snapshots` table has historical values for all capability metrics.  
**Implementation:** For each capability metric, compute 7-day linear regression slope. Count metrics with negative slope. Record count as the metric value.  
**Effort:** ~40 lines. Low risk (simple math on existing data).

## Summary

| Claim | Feasibility | Risk | Lines | Blocker |
|-------|------------|------|-------|---------|
| C2    | ✅ Ready    | Low  | ~30   | None    |
| C3    | ⚠️ Partial  | Med  | ~40   | Low agent.decision volume (S7) |
| C4    | ⚠️ Semantic | Med  | ~50   | Metric measures wrong channel |
| C5    | ✅ Ready    | Low  | ~30   | None    |
| C6    | ✅ Ready    | Low  | ~40   | None    |

## Recommendation

**Phase 1 (this iteration or next):** Implement C2, C5, C6 — all three have data, clear SQL implementations, and low risk. This gets to 20/22 = 0.9091.

**Phase 2 (deferred):** C3 depends on S7 (agent.decision emission coverage). Implement the metric now but accept it measures a small sample. C4 needs a design decision on whether to measure the message channel or add a stigmergic alternative.

**Achievable target:** 20/22 = 0.9091 with Phase 1 alone. 22/22 possible with accepted caveats.
