# KE-140: Agent Read Patterns — Duplicate Reads as Primary Waste

> **Source**: EXP-140 (Agent Read Patterns Observational Study)
> **Date**: 2026-04-11
> **Confidence**: HIGH (N=353 sessions, 1,543 read events)

## Core Finding

Agent sessions are overwhelmingly action-heavy (96%), with reads comprising only 16% of tool calls. The main efficiency problem is **duplicate reads** — 37.8% of all reads are re-reads of the same file within a single session.

## Key Facts

1. **Read distribution**: median 3 reads/session, mean 3.6, range 0-23
2. **73% of reads** are workspace files (40%) + knowledge/skill files (33%)
3. **Top 5 files = 30% of all reads**: dispatch-board.md, scout/todo.md, bob/todo.md, INDEX.md, PRIORITY-TRACKER.md
4. **37.8% duplicate rate**: 584 of 1,543 reads are within-session re-reads
5. **Bob worst offender**: 46% of sessions have duplicates; INDEX.md re-read 47× extra, PRIORITY-TRACKER 47× extra
6. **May re-reads dispatch-board** 3.7×/session (121 total across 33 sessions)
7. **Evaluator wastes 27%** of reads on heartbeat.md (already in context)
8. **No context overload problem**: 0% of sessions are read-heavy (>70% reads)

## Implications

- The read dedup guard may not be catching paginated reads (different offset = different "key")
- Workspace state injection (pre-computed summaries) could eliminate 30% of reads
- Bob needs a "you already read this file" intervention or cached workspace state
- Evaluator should not re-read heartbeat instructions

## Connections

- Read dedup guard: `src/lib/tools/read-dedup-guard.ts` — needs audit
- Bob's navigation loops relate to his knowledge base workflow patterns
- May's dispatch-board re-reads suggest dispatch-board state could be injected
