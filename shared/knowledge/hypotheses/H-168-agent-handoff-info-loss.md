# H-168: Agent handoffs lose >15% of relevant information per boundary

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (initial estimate)
**Source**: DD-597 (DPI argument), DD-595 (integration bottleneck)
**Connects**: KE-216, KE-019, DD-590, DD-595

---

## Claim

Each agent boundary in our system (Scout→Bob, Bob→Tech-lead) loses >15% of task-relevant information per handoff. This means a 2-hop chain (Scout→Bob→Tech-lead) retains <72% of the original information, making single-agent preferable for tasks that fit in one context window.

## Mechanism

The Data Processing Inequality guarantees information can only be lost, never gained, through intermediate processing. Each handoff involves: (1) the sender summarizing/compressing their full reasoning into a message, (2) the receiver interpreting that message without access to the full context. Both steps are lossy. The 15% threshold is conservative — free-text summaries likely lose more, structured formats less.

## Evidence

### Supporting
- DD-597: Single-agent matches/beats multi-agent under equal compute budgets across 3 model families
- DD-595: Integration bottleneck shows quality degrades at agent boundaries
- DD-590: Memory-augmented single agent outperforms multi-agent empirically
- Anecdotal: Bob frequently lacks context from Scout deep-dives that would improve synthesis quality

### Against / missing
- No direct measurement of information loss in our specific handoffs yet
- Specialization benefit may compensate: Scout's research quality + Bob's synthesis quality > either alone
- 15% threshold is assumed, not measured

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Same task given to single-agent with full context vs Scout→Bob pipeline | Single-agent produces equally or more accurate output |
| Structured handoff format (key claims + evidence + confidence) vs free-text | Structured loses <10%, free-text loses >20% |
| 3-hop chain (Scout→Bob→Tech-lead→Coder) | Quality degrades noticeably vs 1-hop |

## Test Plan

- **Design**: Take 10 completed Scout→Bob handoffs. Have a judge score: (a) information present in Scout's full output, (b) information present in Bob's received context. Measure retention rate.
- **Scenario**: Sample from recent deep-dive processing sessions. Compare Bob's KE entries against the full DD content for coverage.
- **Decision rule**: Confirmed if average retention <85% (i.e., loss >15%). Falsified if retention >90% consistently.

## Implications if true

- Invest in structured handoff formats to minimize DPI loss
- For simple tasks, skip intermediate agents (direct context injection)
- Consider "context forwarding" — passing raw source alongside summaries
- Redesign agent boundaries around context window limits, not role abstractions

## Links

- Parent: KE-216
- Related: H-166 (binary threshold model)
- Tracked in: agents/bob/workspace/todo.md
