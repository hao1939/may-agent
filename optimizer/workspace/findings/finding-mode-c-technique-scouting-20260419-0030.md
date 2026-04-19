# Finding: Coach 154-Op Session Technique Analysis

**Mode**: C — Skill & Technique Scouting  
**Date**: 2026-04-19T00:30Z  
**Window**: Last 6 hours

## Summary

The coach's 154-op session (s_1776551125350_659) analyzing persistent-task structural interventions was 7.7x the median coach session (20 ops avg, median ~12). Despite the high cost, it delivered real results (new lab fork, 0%→50% improvement). The cost driver was **infrastructure debugging interleaved with analysis work**.

## High-Op Session Breakdown (154 ops)

**Task**: Analyze persistent-task structural intervention failure and design stronger intervention.

**What it did well**:
- Read passing/failing transcripts to understand failure modes
- Designed a triple-reinforcement intervention (SOUL top + skill + context.md)
- Ran direct gym trials and measured results (2/4 = 50%)
- Committed lab fork with documentation

**What drove cost up**:
1. **Gym batch infrastructure debugging (~40+ ops)**: Discovered gym-batch.sh had a results capture bug (empty temp files). Spent many ops reading batch scripts, checking temp files, debugging redirects — none of which contributed to the actual intervention design.
2. **Repeated gym runs after batch failures (~30 ops)**: Had to re-run trials individually after batch approach failed, including waiting for 900s timeout runs.
3. **Large prompt injection cost**: Each gym-run.sh call with `--inspect` dumped the full system prompt (~4K tokens) into output, inflating context for subsequent turns.

## Technique Comparison: High-Op vs Low-Op Coach Sessions

| Pattern | Low-Op (≤14 ops) | High-Op (≥48 ops) |
|---------|-------------------|---------------------|
| Scope | Single focused task | Multi-deliverable with debugging |
| Gym usage | Direct gym-run.sh or none | Batch attempts that fail → retry individually |
| Infrastructure debugging | None — uses known-working tools | Significant time on tool/script issues |
| Write timing | Early (within 5 calls) | Late (after extensive investigation) |

## Anti-Patterns Identified

1. **Infrastructure debugging in analysis sessions**: When gym-batch.sh failed, the session pivoted to debugging the batch script itself (~40 ops). A lean approach: abandon batch immediately, use direct gym-run.sh, file a bug separately.

2. **Verbose gym output parsing**: Using `--inspect` with grep pipes generated huge outputs. The session then spent ops interpreting/filtering these outputs. Better: use `--quiet` or extract only pass/fail.

3. **Sequential gym runs with full output**: Each gym run took 20-80s and produced large output. Running 4 sequential trials with full output = ~320s of wait time plus massive context bloat. Better: run trials in background, collect only results.

## Reusable Technique Patterns

1. **Direct gym-run.sh over gym-batch.sh**: When batch infrastructure has bugs, skip it entirely. Direct runs are more debuggable and the output is immediate.

2. **Task-level > system-prompt instructions**: The key insight from this session — STEP variant (task instructions) gets 100% compliance vs 50% for system prompt rules. This is a general principle applicable to all behavioral interventions.

3. **context.md as user-message injection point**: context.md content appears in the user message as "What You Know", making it more salient than system prompt skills. This is a powerful and underused injection mechanism.

## Cost Reduction Opportunity

If the coach had:
- Abandoned gym-batch.sh after first failure (save ~40 ops)  
- Used `gym-run.sh` directly from the start (save ~10 ops)
- Not debugged batch infrastructure (file bug instead)

Estimated cost: ~80-90 ops instead of 154 — a **42-48% reduction**.

## Distribution Context

Coach sessions last 6h (n=24):
- Median: ~12 ops
- Mean: 20.1 ops  
- P90: ~48 ops
- Max: 154 ops (this session)
- 75% of sessions ≤14 ops (efficient heartbeats and focused tasks)

The 154-op session is a clear outlier (3.2x P90). Sessions >48 ops all involved gym experimentation with infrastructure issues.
