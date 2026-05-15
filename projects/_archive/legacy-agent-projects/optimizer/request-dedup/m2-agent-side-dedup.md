# M2: Agent-Side "Already Reported" Check

**Status**: Deferred — low ROI after M1+M3

## Analysis

With M1's enhanced inbox dedup, duplicate notifications are collapsed on read. The remaining waste from duplicate *sends* is minimal:
- Each duplicate notification is a single DB insert (~0 LLM cost)
- The agent processing overhead is eliminated by read-side dedup

Adding write-side dedup (checking before sending) would require:
1. Access to the events table from the `notify` tool implementation
2. A content-hashing scheme consistent with loadInbox's normalization
3. Changes to the core tool infrastructure (outside optimizer's scope)

The cost-benefit doesn't justify the complexity. If notification volume becomes a DB performance issue, this can be revisited.

## Recommendation

Close request-dedup project as done. M1+M3 solved the user-facing problem (noisy inboxes). M2 is a premature optimization.
