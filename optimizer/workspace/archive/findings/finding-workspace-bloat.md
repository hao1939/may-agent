# Finding: Workspace Bloat — 1,700+ Stale Files Across Agents

**Date**: 2026-03-18
**Status**: ✅ Addressed — `workspace-compaction` cron handler built (agents/may/handlers/workspace-compaction.ts, daily 24h interval)

## Problem

Agent workspaces have accumulated massive numbers of stale files that are never referenced again:

| Agent | Files | Size | Biggest Offenders |
|-------|-------|------|-------------------|
| Bob | 968 | 6.7MB | `sent/` (375 files, 1.5MB), `archive/` (199 files, 920KB) |
| Scout | 748 | 12MB | `deep-dive-arxiv-*` (207 files), `cross-ref-*` (72 files) |
| Coach | 286 | 6.6MB | Unknown breakdown |
| Optimizer | 102 | 2.9MB | Finding files accumulating |
| **Total** | **2,300+** | **~40MB** | — |

## Evidence

- Bob's `sent/` files date back to Mar 5-12 — most are 6+ days old, never re-read
- Scout's deep-dive files date back to Mar 7-9 — stale research outputs never re-accessed
- Grep of recent sessions shows 0 references to Scout's old deep-dive files
- Bob's session transcript shows Bob trying to clean `ideas.md` but failing on write errors (33KB file too large)

## Impact

1. **Git repo bloat** — these all get committed, growing the repo unnecessarily
2. **Agent confusion** — `ls workspace/` returns hundreds of entries, making it hard to find active work
3. **Potential context waste** — any agent that reads workspace index burns ops on stale entries

## Proposed Fix: Workspace Compaction Handler

A JS handler (daily cron, like `lessons-graduation.ts`) that:

1. For each agent workspace, identifies files not modified in 14+ days
2. Moves them to `workspace/archive/YYYY-MM/` subdirectory
3. Exception list: `todo.md`, `MEMORY.md`, `activity.jsonl` (always keep)
4. Logs actions to a compaction report

**Specific immediate actions:**
- Bob: Move all of `sent/` and `archive/` contents older than 7 days into a dated archive folder
- Scout: Move all `deep-dive-arxiv-*` and `cross-ref-*` older than 14 days to archive
- General: Any file not modified in 14 days → archive

**Estimated savings**: Reduces active workspace files from ~2,300 to ~200, making workspaces navigable and reducing git churn.

## Owner

Send to tech-lead for implementation as a JS handler in `agents/may/handlers/`.
