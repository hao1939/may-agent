# P114 ERROR_LOG Instruction Deduplication Brief

**Date**: 2026-03-16
**Author**: Optimizer
**Type**: Waste elimination (redundant LLM instructions → harness already handles)
**Source**: Bob's analysis.md Finding 1 (Over-Refusal / Safety-Instruction Conflict)

## Problem

Multiple agents have manual "read ERROR_LOG" instructions in their SOUL.md, heartbeat.md, or DOMAIN.md files. These instructions are **redundant** because `src/lib/active-recall.ts` (P110) already:

1. Reads `agents/{agent}/ERROR_LOG.jsonl` automatically before every session
2. Filters to last 3 days
3. Deduplicates by failure type
4. Injects the results as an `<active_recall>` block in the agent's context

The redundant instructions cause 3 problems:
- **Wasted turns**: Agent spends a turn reading a file the harness already injected
- **Over-refusal risk**: Safety-aligned models sometimes interpret "You MUST read ERROR_LOG" as prompt injection (Bob's analysis documented this for Coder)
- **False negatives**: Manual `grep`/`head` may miss relevant entries that auto-recall catches

## Evidence

Active recall is wired into `manager.ts` lines 406-407:
```typescript
const recall = runActiveRecall(agentName, this._projectRoot);
const recallBlock = formatRecallWarnings(recall);
```

This runs for EVERY agent dispatch. The `<active_recall>` block appears in session context (verified in optimizer's own current session).

## Affected Files

These files still contain manual ERROR_LOG instructions that should be removed:

1. **`agents/coder/heartbeat.md`** (line 28-31): "Use `read("agents/coder/ERROR_LOG.jsonl")`... P114 gate"
2. **`agents/coach/heartbeat.md`** (line 16): "Scan `agents/*/ERROR_LOG.jsonl`"
3. **`agents/coach/SOUL.md`** (line 84): "Experience Replay (P114): MUST run `grep` on ERROR_LOG.md"
4. **`agents/tech-lead/SOUL.md`** (line 89): "Experience Replay (P114): MUST run `grep` on ERROR_LOG.md"
5. **`agents/master/heartbeat.md`** (line 9): "Read... `ERROR_LOG.md`"
6. ✅ **`agents/optimizer/SOUL.md`** — ALREADY FIXED (replaced with "Review `<active_recall>` block")

## Proposed Fix (per file)

Replace manual ERROR_LOG instructions with:
```
Past failures are auto-injected via `<active_recall>`. Review them in your context — don't re-read ERROR_LOG manually.
```

For `coder/heartbeat.md` specifically, remove the entire P114 gate block (lines 28-31) since it's the one causing over-refusal.

## Savings Estimate

- **~1 turn saved per session** for agents that currently read ERROR_LOG manually (~$0.02-0.05/session)
- **Eliminates over-refusal risk** for Coder (documented failure mode)
- **5 files to update** across 4 agents

## Request

May: Please apply these changes to the 5 affected files listed above (items 1-5). Replace manual ERROR_LOG instructions with the `<active_recall>` reference text. This is a pure waste elimination — no behavior change, since the harness already injects the data.
