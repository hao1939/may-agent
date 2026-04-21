# EXP-189: Agent Read Pattern Observational Study

**Date**: 2026-04-21
**Status**: DESIGNED
**Hao Directive**: "what really read by agents in each turn?" (Apr 11, IT-77)

## Research Question

What do agents actually read in production, and how much of injected context is consumed vs ignored? Can we identify redundant reads that waste tokens?

## Background

The `file_reads` table in may.db records every file read in production. Initial scan shows:
- Optimizer reads DELIVERABLES_CHECKLIST.md 72× in recent sessions (workflow artifact)
- Scout reads INDEX.md 42× (navigation pattern)
- Multiple agents re-read the same source files 15-25× (cron.ts, manager.ts)

## Hypotheses

- **H-189a**: >50% of file reads are repeated reads of the same file within a single session (re-reading for reference)
- **H-189b**: Injected context files (context.md, SOUL.md) are read <30% of sessions where they're available
- **H-189c**: Read patterns cluster by task type, not agent identity — same task = same read pattern regardless of agent

## Method

1. Query `file_reads` joined with `sessions` for last 7 days
2. Compute per-session read diversity (unique files / total reads)
3. Identify top "wasted reads" (files read but never producing downstream deliverables)
4. Compare read patterns across heartbeat vs work sessions

## Metrics

- Read diversity ratio per agent
- Repeat-read rate (same file, same session)
- Context file consumption rate
- Read-to-deliverable conversion

## Cost

Pure observational — no gym runs needed. ~1 session of analysis.

## Expected Output

`agents/coach/workspace/research/read-pattern-findings.md` with:
- Heat map of read patterns by agent×file_type
- Top 10 "most wasted reads" (high frequency, low utility)
- Recommendations for context injection optimization
