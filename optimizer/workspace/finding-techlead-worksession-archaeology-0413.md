# Finding: Tech-Lead Work Session Archaeology — High-Op Outliers

**Date**: 2026-04-13 10:22 UTC  
**Scope**: Tech-lead forked work sessions, last 24h (12h focus, 7d context)  
**Sessions analyzed**: Top 3 outliers (96, 86, 84 ops) + 10 comparison sessions

## Summary

Tech-lead work sessions average 28.5 ops (7d, n=120) with a long tail: 15 sessions >50 ops account for 31.3% of all ops (1,069/3,418). The top 3 in 24h (96, 86, 84 ops) reveal **three distinct anti-patterns**, only one of which has a clean structural fix.

## The Three Anti-Patterns

### 1. Grep-Then-Read Spiral (86-op session — State Machine Audit)

**The dominant pattern.** Session spent 85/86 ops on bash, with:
- 37 `sed -n` line-range reads (43% of bash calls)
- 41 `grep -n` searches (47% of bash calls)
- 21 separate sed reads of `manager.ts` alone (a 2,443-line file)
- Only 12 `read()` tool calls (14% of tool use)
- 10 compaction events (context grew too large, was trimmed repeatedly)

**What happened**: The task said "Map the full session state machine" across 3 files. Tech-lead used `grep -n 'status'` to find a reference → `sed -n '925,1100p'` to read 60-100 lines around it → grep for the next concept → sed another chunk. This creates a **2-op tax per code exploration** (grep to locate + sed to read) vs. 1 op with `read(path, {offset, limit})`.

**The file: `manager.ts` at 2,443 lines** is read in 21 separate windows. With `read()` using offset/limit, the same coverage requires ~5-8 calls. That's **13-16 ops saved on one file alone**.

**Output**: 1 finding file (`.state/audit/session-lifecycle-state-machine.md`). Ratio: 86 ops → 1 deliverable.

### 2. Tool Discovery Fumbling (84-op session — Checkpointing Experiment)

**Environment ignorance burns ops.** Session spent 81/84 ops on bash, with:
- **11 failed `sqlite3` attempts** — sqlite3 CLI doesn't exist in this environment
- 14 "# Experiment N:" comments embedded in bash commands (no-op overhead)
- 3 `code-search.sh` attempts (tool doesn't exist as a shell script)
- 21 compaction events (worst of any session analyzed)
- 5 git commands at the end for committing

**What happened**: The task asked to investigate checkpoint utilization. Tech-lead tried `sqlite3 .state/sessions.db`, `sqlite3 .state/db.sqlite`, `sqlite3 .state/requests.db`, `sqlite3 .state/requests.sqlite`, `sqlite3 .state/persist/may.db`, `sqlite3 .state/may.db` — all failing. Eventually discovered `bun -e "import {Database} from 'bun:sqlite'"` works. This burned ~15 ops on tool discovery alone.

**Separately**, the agent embedded `# Experiment 1:` ... `# Experiment 20:` comments in bash commands, creating a numbered experiment journal via bash comments. This "experiment journaling in bash" pattern adds zero information value but costs context tokens.

**Output**: 2 edits to an existing research doc. Ratio: 84 ops → 2 paragraph additions.

### 3. Multi-Branch Git Operations (96-op session — Review Branch Cleanup)

**Legitimate complexity, not waste.** Session processed 16 review branches: checking merge-ability, resolving conflicts, running tests, committing. 93/96 ops were bash (git operations).

This is **not an anti-pattern** — each branch requires multiple git commands. The 96-op count is high but proportional to the task scope (16 branches). A cap would break this workflow. However, dispatching 16 branches as a single session is suboptimal — could be 4 sessions of 4 branches each.

## Comparison: Efficient Sessions

| Session | Ops | Task Type | Key Difference |
|---------|-----|-----------|----------------|
| 13-op (dead code removal) | 13 | Bounded | 0 compactions, used `workflow` tool, 12 bash + 4 read |
| 20-op (library audit) | 20 | Scoped | 2 compactions, 19 bash but all targeted |
| 25-op (request tracking) | 25 | Architecture | 24 bash + 2 read, focused on 1 file |
| 39-op (tool dispatch) | 39 | Trace | Higher but proportional to 6 files traced |

**The pattern**: Efficient sessions have **bounded scope** (1 file or 1 concept), **zero or few compactions**, and use `read()` for large files instead of grep→sed loops.

## Lens Type Analysis (24h)

| Lens | Sessions | Avg Ops | Max | Notes |
|------|----------|---------|-----|-------|
| A (Architecture) | 6 | 43.7 | 86 | Highest — open-ended audits |
| C (Cleanup) | 6 | 31.5 | 96 | Branch cleanup outlier |
| D (Fragility) | 7 | 29.6 | 54 | More bounded |
| B (Complexity) | 6 | 26.2 | 39 | Most bounded — trace one path |
| Other | 10 | 28.9 | 84 | Research/experiment tasks |

Lens A (architecture audits) averages 67% more ops than Lens B (complexity traces). The key difference: Lens A says "map the full X" (open-ended), while Lens B says "trace path from A to B" (bounded endpoint).

## Root Causes

### Primary: Grep-Then-Read Pattern (affects all high-op audit sessions)
- Tech-lead uses `grep -n` → `sed -n` instead of `read(path, {offset, limit})`  
- Each code exploration costs 2 ops instead of 1
- Large files (manager.ts 2,443 lines) get read in 21 separate chunks
- **Estimated waste: 30-40% of ops in audit sessions** (15-25 ops/session)

### Secondary: Missing Environment Knowledge
- sqlite3 CLI doesn't exist (use bun:sqlite)
- code-search.sh doesn't exist as a shell script
- Context.md mentions these facts but agent ignores them (confirmed KE-011 pattern)
- **Waste: 10-15 ops in ~25% of research sessions** (when DB queries are needed)

### Tertiary: Scope Unboundedness
- "Map the full X" tasks have no completion criterion
- Agent keeps exploring until it feels done or hits compaction limits
- 10-21 compaction events = context grew past limits multiple times

## Potential Fixes (ranked by impact)

### Fix 1: Task Scope Caps (Structural — HIGH IMPACT)
Add explicit op budget to dispatched work session tasks:
- Lens A/C tasks (audits, cleanup): "Budget: 40 ops max. Focus on top 3 findings."
- Lens B tasks (traces): already naturally bounded (~26 avg)
- Research tasks: "Budget: 40 ops max. Write checkpoint before deep-diving."

**Projected savings**: If all >50-op sessions capped to 50, saves ~370 ops/week (1,069 current - 750 capped = 319 saved, per 7d).

### Fix 2: read() Nudge in Task Prompt (Behavioral — MEDIUM IMPACT)
Add to work session dispatch: "Use read(path, {offset, limit}) for file exploration — not grep→sed loops."

**Projected savings**: 10-15 ops per audit session × ~30 audit sessions/week = 300-450 ops/week.

**Risk**: Behavioral nudges have mixed track record (KE-011 — agents skip passive knowledge). But task-level injection is stronger than context.md.

### Fix 3: Environment Facts in Task Prompt (Behavioral — LOW-MEDIUM IMPACT)
Add to research/experiment tasks: "DB access: bun -e 'import {Database} from \"bun:sqlite\"'. No sqlite3 CLI."

**Projected savings**: ~10 ops × ~3 affected sessions/week = 30 ops/week. Small but free.

### Fix 4: Batch Dispatch for Multi-Item Tasks (Structural — NARROW IMPACT)
Instead of dispatching "process 16 branches" as one session, dispatch 4 sessions of 4 branches each.

**Projected savings**: Prevents single 96-op sessions, but total ops may not change much (overhead of 4 sessions).

## Recommendation

**Fix 1 (op budget in task prompt) is the highest-leverage intervention.** It mirrors the D-o-R P1 budget cap that achieved 71% reduction for bob. Key difference: bob's P1 was a workflow prompt (structural), while tech-lead work sessions are dispatched by heartbeat (behavioral). 

The fix point is **tech-lead's heartbeat dispatch logic** — where it constructs the `[WORK SESSION]` task string. Adding "Budget: 40 ops" to Lens A and research tasks would cap the long tail without harming already-efficient sessions.

**NOT recommended**: Fix 2 alone (read() nudge). Text rules don't change LLM behavior (KE-002). The budget cap is more enforceable because it's a clear stopping criterion.

## Key Numbers

- 7d tech-lead work sessions: 120 sessions, 3,418 total ops, 28.5 avg
- >50 op sessions: 15 (12.5% of sessions, 31.3% of ops)
- 86-op session: 85 bash calls (37 sed + 41 grep + 5 cat/ls + 2 other), 12 reads, 1 write
- 84-op session: 81 bash calls (11 failed sqlite3, 14 experiment-journal comments), 18 reads
- 21 sed reads of manager.ts in single session (could be ~5-8 read() calls)
- 10-21 compaction events in high-op sessions vs 0-2 in efficient ones
