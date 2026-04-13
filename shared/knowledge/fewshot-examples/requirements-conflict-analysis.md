# Few-Shot Example: Requirements Conflict Analysis

**Domain class**: Tasks with potentially conflicting or impossible-to-satisfy-simultaneously requirements  
**Skill**: requirements-conflict-analysis (judgment)  
**Token estimate**: ~550 tokens

## Trigger Patterns

```regex
/contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off|can'?t.*satisfy.*both|infeasible|requirements.*tension|constraint.*violation/i
```

## Worked Example

> **Reference: How an experienced engineer handled conflicting requirements**
>
> An engineer was asked to build a data migration pipeline that processes 10,000 records/sec while maintaining strict chronological ordering across all output partitions.
>
> **Step 1 — Analyze feasibility before coding**:
> The engineer wrote `ANALYSIS.md` before touching any implementation:
> - 10K records/sec requires parallelism across at least 4 workers
> - Strict chronological ordering requires a single serialization point
> - A single serialization point caps throughput at ~3K records/sec (measured)
> - **Contradiction**: parallelism for throughput destroys the ordering guarantee
>
> **Step 2 — Identify the mathematical conflict**:
> ```
> Throughput requirement: 10,000 rec/sec → needs ≥4 parallel workers
> Ordering requirement: strict chronological → needs 1 serial worker
> 4 parallel workers ≠ 1 serial worker → IMPOSSIBLE to satisfy both
> ```
>
> **Step 3 — Propose alternatives with explicit tradeoffs**:
> 1. **Relaxed ordering**: Partition by source ID → 10K/sec throughput, ordering within each partition only
> 2. **Relaxed throughput**: Single worker → strict ordering, ~3K records/sec
> 3. **Hybrid**: Parallel processing + merge-sort on timestamp at output → ~7K/sec with ~200ms ordering delay
>
> **What the engineer delivered**:
> - `ANALYSIS.md` documenting the contradiction and three alternatives
> - Implemented Alternative 3 (hybrid) as the best compromise
> - Status: **success** — the analysis itself was essential, not just the code
>
> **Why this matters**: In a previous session without this analysis step, an agent jumped straight into parallelization, hit the ordering constraint after 45 minutes of coding, and had to restart from scratch. The 5-minute feasibility analysis saved hours of wasted work.
>
> **The rule**: When requirements include multiple hard constraints (especially performance + correctness), ALWAYS check mathematical feasibility before implementing. Write the analysis first. If constraints conflict, propose alternatives with explicit tradeoffs rather than silently dropping a requirement.

## Evidence

| Experiment | Condition | Result |
|---|---|---|
| EXP-084 Treatment B | Few-shot example (task message) | 3/3 analysis-exists, 3/3 contradiction-identified (avg 4.3/5) |
| EXP-084 Control | No example (baseline) | 0/3 analysis-exists, 0/3 contradiction-identified (avg 2.0/5) |
| EXP-084 Treatment D | Echo-back self-prompting | 3/3 analysis-exists, 1/3 contradiction-identified (avg 3.3/5) |
| EXP-084 Treatment C | Checklist injection | 2/3 analysis-exists, 1/3 contradiction-identified (avg 4.0/5) |

**Key finding**: Few-shot was the strongest treatment — only method with 3/3 on both analysis-exists AND contradiction-identified. Score improvement of +2.3/5 over baseline (p=0.050 on analysis-exists criterion).

## Source

Synthesized from: EXP-084 contradictory-requirements scenario + Treatment B few-shot example design

