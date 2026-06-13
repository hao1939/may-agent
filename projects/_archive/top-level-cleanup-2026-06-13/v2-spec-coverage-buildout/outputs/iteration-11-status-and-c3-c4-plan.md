# Iteration 11 — Status Update & C3/C4 Implementation Plan

**Date:** 2025-05-10  
**Current coverage:** 20/22 = 0.9091 (exceeds 0.8182 acceptance threshold ✅)  
**Target:** 22/22 = 1.0

## Current State

The metric `v2.spec-coverage-rate` is now at **0.9091** — up from 0.7727 reported in the project state. The C2, C5, C6 implementations from iteration 10 are live and producing snapshots. The S2/S3/S4 structural holds also count as covered (empty metric arrays → auto-measured).

### Remaining Uncovered Claims (2/22)

| Claim | Required Metric | Status | Data Available |
|-------|----------------|--------|----------------|
| C3 — Memory & continuity | `capability.journal-reference-rate` | Not registered | 277 `agent.decision` events |
| C4 — Coordination | `capability.message-conversation-close-rate` | Not registered | 85,637 `message.created` events |

## C3 Implementation Plan

**Metric:** `capability.journal-reference-rate`  
**Definition:** Fraction of agent heartbeat sessions where the agent references prior journal entries or persistent context in its decisions.

**Approach:**
1. Register `capability.journal-reference-rate` in METRIC_DEFS (gauge, target ≥ 0.5, threshold < 0.1)
2. Query `agent.decision` events from last 7 days
3. For each, check if `data` JSON contains references to journal dates (YYYY-MM-DD patterns) or `context.md`/`journal/` paths
4. Rate = events-with-references / total-decision-events

**Risk:** Low volume (277 events total). Metric will be noisy but functional. Improves as S7 (heartbeat-decision-rate) increases agent.decision emission.

**Lines:** ~35 in metrics-snapshot.ts

## C4 Implementation Plan

**Metric:** `capability.message-conversation-close-rate`  
**Definition:** Fraction of inter-agent messages that receive a reply or acknowledgment.

**Approach:**
1. Register `capability.message-conversation-close-rate` in METRIC_DEFS (gauge, target ≥ 0.8, threshold < 0.3)
2. Query `message.created` events from last 7 days
3. For each message, check if a reply exists from the recipient (matching on conversation thread or to/from reversal)
4. Rate = messages-with-reply / total-messages

**Caveat (from iteration 9 analysis):** Agents coordinate primarily through shared files (stigmergy), not messages. This metric measures the message channel specifically. It will likely show a reasonable close rate since messages that ARE sent tend to be handled. The spec notes this semantic limitation.

**Lines:** ~50 in metrics-snapshot.ts

## Recommendation

Both metrics are implementable with existing data. Implementing them would bring coverage to **22/22 = 1.0**, fully satisfying the acceptance criteria.

**Priority:** These are P2 — the 0.9091 rate already exceeds the 0.8182 threshold. Implementing C3/C4 is a completeness improvement, not urgent.

**Next step:** Implement both metrics in `metrics-snapshot.ts`, update v2-spec.md Measurement sections if needed, and verify snapshots appear within one metrics cycle.
