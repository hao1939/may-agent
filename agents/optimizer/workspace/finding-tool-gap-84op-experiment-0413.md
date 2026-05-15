# Finding: Tool Gap Analysis — Tech-Lead 84-op Experiment Session (Progress Checkpointing)

**Date**: 2026-04-13 ~11:22 UTC  
**Session**: s_1776079335291_155 (Optimizer Mode B)  
**Method**: Full tool-call extraction from session.jsonl of s_1776070334953_93 (tech-lead, 84 ops, 775s / 13 min). Categorized all 117 tool calls, identified consecutive-run patterns, timed each phase via receipts.jsonl, compared against existing tools.

---

## Executive Summary

The tech-lead 84-op experiment session (Harness Engineering — Progress Checkpointing) spent **78% of ops (91/117) on bash calls**, of which **18 ops (20% of bash) were pure DB discovery waste** — trying wrong database paths (sessions.db, db.sqlite, requests.db, persist/may.db) before finding .state/may.db. Another **10 ops re-read files already in context** (Phase 4 context window rebuild). The session used `code-search.sh` 3 times but fell back to raw grep for 25 subsequent searches. Three concrete tool gaps identified, with estimated 30-40 op savings (36-48% reduction).

## Session Profile

| Metric | Value |
|--------|-------|
| Session ID | s_1776070334953_93 |
| Agent | tech-lead |
| Op count | 84 (117 tool calls, some parallel) |
| Duration | 775s (13 min) |
| Avg time/op | 7.3s |
| Task | Design experiment for improved progress checkpointing |
| Output | Empirical audit added to research project file |
| Children | 0 (no delegation) |

### Tool Call Distribution

| Tool | Count | % |
|------|-------|---|
| bash | 91 | 78% |
| read | 19 | 16% |
| edit | 3 | 3% |
| checkpoint | 2 | 2% |
| finish | 2 | 2% |

### Bash Command Categories (91 commands)

| Category | Count | % of bash |
|----------|-------|-----------|
| GREP_SEARCH | 25 | 27% |
| DB_QUERY (sqlite3 CLI) | 14 | 15% |
| DB_QUERY (python3+sqlite3) | 12 | 13% |
| FILE_DISCOVERY (ls, find, wc) | 7 | 8% |
| GIT_OPS | 5 | 5% |
| CODE_SEARCH_TOOL | 3 | 3% |
| OTHER (echo, for-loops, etc.) | 25 | 27% |

---

## Phase-by-Phase Analysis

### Phase 1-3: Research + Code Discovery (ops 1-21, ~44s)
**Purpose**: Read research project, find checkpoint-related source code  
**Pattern**: Read → code-search.sh × 3 → grep fallback × 8 → read source files  
**Waste**: code-search.sh was tried 3 times, then abandoned for raw grep (25 grep calls follow). The agent likely found code-search.sh output format unfamiliar or insufficient, reverting to known patterns.  
**Productive ops**: ~15 of 21 (71%)

### Phase 4: Context Window Rebuild (ops 22-32, ~48s)
**Purpose**: Re-read all files already examined to consolidate understanding  
**Pattern**: 10 consecutive read() calls re-reading the same 6 files  
**Waste**: **10 ops (100% waste)** — the agent re-read `harness-engineering-long-running-agents.md` 4 times total, `session-digest.ts` 2x, `checkpoint.ts` 2x, etc. This is a classic context window eviction pattern: the LLM "forgot" earlier content after too many intervening tool calls.  
**Root cause**: No summarization/extraction tool. The agent reads a file, does 20 other things, then needs to re-read because the content scrolled out of its effective window.

### Phase 5-6: DB Discovery Spiral (ops 33-58, ~155s — **20% of session time**)
**Purpose**: Find session outcome data to analyze checkpoint effectiveness  
**Pattern**: 26 ops trying to locate the right database:
- sqlite3 .state/sessions.db → empty
- sqlite3 .state/main.db → doesn't exist
- sqlite3 .state/db.sqlite → doesn't exist
- sqlite3 .state/requests.db → empty
- sqlite3 .state/requests.sqlite → doesn't exist
- find .state -name "*.db" → found files, but sqlite3 isn't available
- Tried `which sqlite3` → not found
- Switched to python3 → finally worked
- Eventually discovered .state/may.db (the right one) at op 79-81

**Waste**: **18 ops of pure discovery** (trying wrong DB paths, discovering sqlite3 CLI not available, switching to python3 as workaround). The agent's context.md did not include the fact that `.state/may.db` is the database or that `bun -e` should be used for queries.

### Phase 7-8: Session Data Mining + Deep Analysis (ops 59-94, ~230s)
**Purpose**: Analyze checkpoint usage rates, session outcomes, digest system  
**Pattern**: 8 python3 heredoc scripts querying may.db, interspersed with 5 greps on session-digest.ts  
**Productivity**: High — these were the core analytical ops. But each python3 heredoc was ~15-40 lines of inline code that could have been a single `session-query.ts` call.  
**Notable**: Agent used `python3 + sqlite3` module (12 calls) instead of `bun -e` with `bun:sqlite`. The bun approach is documented in context.md but the agent either didn't read it or preferred python.

### Phase 9-10: Recovery Analysis + Write (ops 95-108, ~150s)
**Purpose**: Final analysis experiments, then write results to research project file  
**Pattern**: 4 more python3 queries, then 3 edits to research project file  
**Productivity**: High — actual delivery work

### Phase 11: Git + Finish (ops 109-117, ~76s)
**Purpose**: Commit results and finish  
**Pattern**: 5 git commands, 2 finish() calls  
**Waste**: 1 wrong-path attempt (`cd /root/project`), 1 failed `git add` (file was gitignored), required branch workaround. The agent also called finish() twice (success, then did more work, then finish again).

---

## Three Tool Gaps Identified

### Gap 1: Database Context Injection (est. 18 ops saved)

**Problem**: The agent spent 18 ops discovering that `.state/may.db` is the database, that `sqlite3` CLI isn't available, and that `bun -e` or `python3` must be used instead. This information exists in optimizer's context.md but not in tech-lead's.

**Current state**: The fact "sqlite3 CLI is not available — query .state/may.db with bun" is in optimizer's persistent context. Tech-lead's context.md does not contain this.

**Fix**: Inject DB access patterns into tech-lead's context.md (or all agents), or create a `db-query` wrapper script:

```bash
#!/usr/bin/env bun
// scripts/db-query.ts — Query may.db with a single command
// Usage: bun scripts/db-query.ts "SELECT agent, COUNT(*) FROM sessions GROUP BY agent"
```

**Impact**: Eliminates entire DB discovery spiral (18 ops). Every research/investigation session that needs DB access benefits.

**Confidence**: Certain — 18 ops directly attributable to not knowing the DB path/tool.

### Gap 2: Session Data Query Tool (est. 8-12 ops saved)

**Problem**: After finding the database, the agent wrote 8 inline python3 heredocs (12-40 lines each) to answer questions like:
- "How many sessions use checkpoints?" (1 query)
- "What's the checkpoint rate per agent?" (1 query)  
- "Do sessions with checkpoints have better outcomes?" (1 query)
- "What's the digest coverage?" (1 query)

`scripts/session-query.ts` already exists and handles several of these patterns, but the tech-lead didn't use it — it's not in their context.md, and even if it were, the tool doesn't support checkpoint-specific queries.

**Fix**: Two options:
1. **Extend session-query.ts** with `--checkpoints` flag (list sessions with/without checkpoints, compare outcomes)
2. **DB query helper**: A generic `bun scripts/db-query.ts "SQL"` that handles the boilerplate (import, path, readonly) and just takes raw SQL

Option 2 is simpler and more general. The agent clearly knows SQL — the waste is in the python3 heredoc boilerplate, not the query logic.

**Impact**: Each python3 heredoc is ~3-5 lines of boilerplate + the actual query. A `db-query.ts` script saves 1-2 ops per query (eliminate boilerplate + error handling). Across 12 queries: ~8-12 ops saved.

**Confidence**: High — the queries are legitimate; only the invocation overhead is waste.

### Gap 3: Context Summarization / Sticky Notes (est. 10 ops saved)

**Problem**: Phase 4 consumed 10 ops re-reading 6 files already examined in Phases 1-3. The agent's effective context window couldn't retain the details from earlier reads after 20+ intervening bash calls pushed them out.

The `checkpoint()` tool was used (op 32) — but checkpoint saves to filesystem for cross-session recovery, not for within-session context retention.

**Current state**: Agents have no mechanism to "pin" extracted facts from a file read. Every re-read costs a full op.

**Potential fix**: A `notes` or `memo` tool that stores key-value facts in the current turn's context:
```
notes({key: "checkpoint.ts", value: "Saves to .state/checkpoints/<sessionId>.jsonl, one line per call. readLatestCheckpointForAgent() returns last checkpoint per agent from latest/ dir."})
```
These notes would be re-injected at the top of the next assistant turn, surviving context window pressure.

**Caveat**: This is harder to implement (requires harness changes) and may not be worth it if the real fix is just "read less, plan more." The 10-op re-read pattern might also be an LLM attention issue that a tool can't fix.

**Impact**: ~10 ops in this session. Likely applies to all research/investigation sessions >50 ops.

**Confidence**: Medium — the pattern is clear but the tool solution is uncertain.

---

## Comparison with Existing Tools

| Tool | Available? | Used? | Could have helped? |
|------|-----------|-------|-------------------|
| scripts/code-search.ts | ✅ | ❌ (used code-search.sh 3x then abandoned) | Yes — would have replaced ~15 of the 25 grep calls |
| scripts/session-query.ts | ✅ | ❌ | Partially — handles session listing but not checkpoint correlation queries |
| scripts/gym-batch.sh | ✅ | N/A | Not relevant (no gym runs) |
| checkpoint() | ✅ | ✅ (2x) | Used correctly for cross-session recovery |
| bun -e for DB | Context-documented | ❌ (used python3 instead) | Would have been ~2 lines shorter per query |

**Key observation**: The agent used `scripts/code-search.sh` (the shell wrapper) 3 times, not `scripts/code-search.ts` (the bun tool). After 3 uses, it fell back to raw grep — suggesting the shell wrapper was either slow, produced unfamiliar output, or didn't support the `--path` filtering the agent wanted.

---

## Aggregate Savings Estimate

| Gap | Ops Saved | % of 84 total | Difficulty |
|-----|-----------|----------------|------------|
| DB context injection | 18 | 21% | Easy (context.md edit or 20-line script) |
| Context re-read elimination | 10 | 12% | Hard (harness change) or Medium (planning discipline) |
| DB query boilerplate reduction | 8-12 | 10-14% | Easy (30-line db-query.ts) |
| **Total** | **36-40** | **43-48%** | |

If all three gaps were addressed, this 84-op session could have been **44-48 ops** — a 48% reduction.

---

## Cross-Reference with Prior Findings

| Pattern | Seen in Apr 11 analysis? | Seen here? | Evolution |
|---------|-------------------------|------------|-----------|
| Grep chains (5-16 consecutive) | ✅ (166/626, 26.5%) | ✅ (25/91, 27%) | Identical prevalence |
| DB query chains | ✅ (145/626, 23.2%) | ✅ (26/91, 29%) | Higher in research sessions |
| DB discovery spiral | ❌ (not identified) | ✅ (18 ops) | **New pattern** — only visible in sessions by agents without DB knowledge |
| Context window rebuild | ❌ (not identified) | ✅ (10 ops) | **New pattern** — only visible in deep-read sessions |
| code-search abandonment | ❌ (tool didn't exist then) | ✅ (3 uses then 25 greps) | **New pattern** — tool exists but isn't sticky |
| Fleet status duplication | ✅ (10/18 sessions) | ❌ (not a heartbeat) | N/A — this was a work session, not heartbeat |

**Two genuinely new patterns identified**: DB discovery spiral and context window rebuild. These weren't visible in the April 11 analysis because that focused on heartbeat sessions (which already know the DB path) rather than novel research sessions.

---

## Recommendation Priority

1. **P0: Propagate DB knowledge to all agents** — Add `.state/may.db` path + `bun -e` pattern to all agent context.md files. Cost: 5 minutes. Saves: 10-18 ops/session for any research task.

2. **P1: Build `scripts/db-query.ts`** — 30-line wrapper that takes raw SQL and returns results. Eliminates python3 heredoc boilerplate. Cost: 30 minutes. Saves: 1-2 ops per DB query.

3. **P2: Investigate code-search.sh abandonment** — Why did the agent revert to grep after 3 code-search.sh calls? If the output format is unfriendly or the flags are confusing, fixing that is higher leverage than building new tools.

4. **P3: Context pinning tool** — Only worth building if the re-read pattern appears across many sessions. Need to measure prevalence first.
