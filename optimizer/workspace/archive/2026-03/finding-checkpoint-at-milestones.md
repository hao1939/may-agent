# Finding: Checkpoint-at-Milestones — Analysis & Recommendation

**Date**: 2026-03-23T12:50 UTC  
**Author**: Optimizer  
**Origin**: Pattern scan finding of 3 candidate skills for lifecycle  
**Status**: Analyzed — **No new skill recommended** (existing coverage sufficient)

## Summary

Investigated the "checkpoint-at-milestones" pattern to determine if it warrants a dedicated skill. After analyzing checkpoint usage across 14,721 sessions, the evidence shows:

1. **Checkpoint underuse is the problem, not overuse** — only 149 sessions (1%) use checkpoints at all
2. **Only 1 session shows excessive checkpointing** — Bob's `s_1774256764786_11` with 16 checkpoints out of 51 tool calls (31%)
3. **Well-disciplined sessions use 1-2 checkpoints** at meaningful milestones
4. **Budget-before-act already prescribes checkpoint discipline** at 50% and 75% marks

## Data

### Checkpoint Usage Distribution

| Checkpoint Count | Sessions | Notes |
|-----------------|----------|-------|
| 0 | 14,572 (99%) | Most sessions never checkpoint |
| 1 | ~100 | Healthy: single checkpoint at key milestone |
| 2 | ~40 | Healthy: two milestones (e.g., data gathered + analysis written) |
| 3 | ~8 | Borderline: might indicate granularity issues |
| 16 | 1 | Bob `s_1774256764786_11` — clear overuse |

### The Bob Outlier (16 checkpoints)

The only session with >3 checkpoints was Bob's gym debugging session (`s_1774256764786_11`). Analysis of checkpoint summaries reveals:

- Checkpoints 1-9: Incremental debugging progress, each recording one small step ("read file X", "checked agent.json", "blocked from reading Y")
- Checkpoints 10-16: Active fix implementation, each recording one edit or verification
- **Pattern**: Checkpoint used as a thinking log / progress journal, not as crash recovery
- **Cost**: 16 checkpoint calls consumed ~31% of the session's tool call budget
- **Value**: Low — the summaries record ephemeral reasoning, not durable milestones

### Well-Disciplined Sessions (1-2 checkpoints)

Example: Optimizer `s_1774267565542_42` — 1 checkpoint in a cost-analysis session:
- Checkpoint after completing the full scan and writing the finding
- Summary captures: methodology, key metrics, and where the finding was written
- A subsequent session could resume from this checkpoint meaningfully

Example: Coach `s_1773819554168_1` — 2 checkpoints in a 99-tool-call session:
- Checkpoint 1 after initial investigation phase
- Checkpoint 2 after completing primary deliverable
- Both record decision-relevant state, not incremental progress

## Analysis: Why Not a Standalone Skill?

### 1. The failure mode is rare
With only 1 session showing excessive checkpointing out of 14,721, this isn't a systemic problem. Creating a skill for a 0.007% occurrence rate doesn't meet the "3+ failures across 2+ agents" threshold from the skill lifecycle.

### 2. Budget-before-act already covers checkpoint discipline
The existing `budget-before-act` skill (v1.0.0) explicitly prescribes:
- **Step 3**: Checkpoint at 50% — verify deliverable exists
- **Step 4**: Verify delivery at 75% — ensure output is coherent
- **AP-3**: Anti-pattern "Optimistic Non-Checkpointing" — addresses agents who don't checkpoint at all

A separate "checkpoint-at-milestones" skill would duplicate this guidance.

### 3. The real problem is underuse, not misuse
99% of sessions use zero checkpoints. The opportunity isn't teaching agents *how* to checkpoint well — it's getting them to checkpoint *at all*. This is better addressed by reinforcing budget-before-act adoption than by creating a new skill.

### 4. The overuse pattern is agent-specific
Bob's excessive checkpointing happened in one unusual session (gym debugging with read-blocking). It's not a generalizable anti-pattern — it's a specific agent's response to a frustrating debugging scenario.

## Recommendations

### Do Not Create
- No standalone "checkpoint-at-milestones" skill

### Minor Enhancement to Budget-Before-Act (Optional, Low Priority)
Consider adding a brief note to the AP-3 section of budget-before-act:

> **Checkpoint frequency**: 1-2 checkpoints per session is optimal. Checkpoint when you've completed a meaningful phase (investigation done, deliverable written, verification passed) — not after every tool call. If you're checkpointing more than 3 times, you're using checkpoints as a thinking log instead of crash recovery, which wastes tool calls.

**Priority**: Low. This is a preventive measure for a pattern seen exactly once.

### Higher Priority: Checkpoint Adoption
The bigger finding from this analysis is that 99% of sessions never checkpoint. This means the crash-recovery value of checkpoints is almost entirely unrealized. If sessions crash (and they do — `done` status without `finish()` call suggests some do), the work is lost.

**Suggestion for coach**: When training agents, emphasize that checkpointing is cheap (~1 tool call) and provides significant crash resilience. The budget-before-act skill already teaches this — the question is whether agents are loading and following that skill.

## Status of All 3 Candidates from Pattern Scan

| # | Candidate | Verdict | Reason |
|---|-----------|---------|--------|
| 1 | Checkpoint-at-milestones | **No new skill** | Covered by budget-before-act; only 1 outlier session |
| 2 | Scope discipline in heartbeats | **Already exists** | `scope-discipline` v1.0.0 + `task-adherence` v1.0.0 |
| 3 | Debug escalation | **No new skill** | Overlaps with `search-strategy-escalation`; low priority |

All 3 candidates from the pattern scan are addressed by existing skills. No new skill creation needed from this analysis cycle.

## Conclusion

The "checkpoint-at-milestones" pattern does not warrant a standalone skill. The existing `budget-before-act` skill provides sufficient guidance on checkpoint discipline. The one excessive-checkpoint case (Bob, 1 session) doesn't meet the threshold for systemic intervention. The broader opportunity is increasing checkpoint adoption from the current 1% baseline.
