# Finding: Coach Multi-Step Bash Patterns — Tool Gap Analysis

**Date**: 2026-04-11  
**Session**: s_1775904850180_1379 (Mode B — Tool Gap Analysis)  
**Scope**: 80 coach sessions, last 24h (2,977 ops total, 2,221 bash commands)  
**Method**: Extracted and categorized all bash tool calls from session.jsonl across 80 coach sessions. Identified multi-step patterns, consecutive burst sequences, and cross-referenced with existing tools (gym-batch.sh, gym-stats.ts, session-query.ts).  
**Prior work**: [finding-coach-session-efficiency-0410.md](finding-coach-session-efficiency-0410.md) (identified file discovery spirals at 32.7%), [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) (tech-lead/coach 6h window, identified convention drilling)

---

## Executive Summary

Coach sessions burn **74.6% of all ops on bash commands** (2,221 of 2,977 ops across 80 sessions in 24h). The top 5 multi-step patterns account for **1,418 bash calls (63.8% of all bash)** that could be substantially reduced by tools — most of which already exist but aren't being used.

The single biggest finding: **`gym-batch.sh` exists but is used only once** vs. 193 individual `gym-run.sh` calls. If coach used gym-batch for its experiment sessions (which average 10 gym runs each), it would save ~150 ops/day. Combined with the other 4 patterns, estimated total savings: **~500 ops/day (22% of total coach output)**.

---

## Data: Full 80-Session Bash Category Distribution

| Category | Count | % of Bash | % of All Ops | Key Pattern |
|----------|-------|-----------|--------------|-------------|
| GREP_SEARCH | 354 | 15.9% | 11.9% | Code/config exploration chains |
| FILE_INSPECT | 330 | 14.9% | 11.1% | head/tail/wc -l on source files |
| FILE_DISCOVERY | 285 | 12.8% | 9.6% | ls/find to enumerate directories |
| DB_OTHER | 276 | 12.4% | 9.3% | Session/evaluation/schema queries |
| GYM_QUERY | 211 | 9.5% | 7.1% | gym_runs/gym_checks DB lookups |
| GYM_RUN | 193 | 8.7% | 6.5% | Individual gym-run.sh invocations |
| OTHER | 155 | 7.0% | 5.2% | Miscellaneous (tsc, vitest, etc.) |
| DB_CONVENTION | 142 | 6.4% | 4.8% | convention_checks queries |
| FILE_READ_BASH | 131 | 5.9% | 4.4% | cat of source/agent files |
| GIT_OPS | 96 | 4.3% | 3.2% | git log/diff/branch operations |
| FILE_MANIPULATION | 28 | 1.3% | 0.9% | mkdir/cp/rm for scenario setup |
| PYTHON_ANALYSIS | 19 | 0.9% | 0.6% | scipy stats, JSON parsing |
| **GYM_BATCH** | **1** | **0.0%** | **0.0%** | **Tool exists, not used** |

---

## Top 5 Multi-Step Patterns

### Pattern 1: Manual Gym Runs (193 calls → should be ~20)

**The problem**: Coach runs experiments with 6-26 individual `gym-run.sh` invocations per session, each a separate bash call. A batch tool (`gym-batch.sh`) exists and was specifically designed to replace this pattern — but it's used exactly **once** across 80 sessions.

**Evidence** (top gym-heavy sessions, last 24h):

| Session | Gym Runs | gym-batch | Total Ops | Experiment |
|---------|----------|-----------|-----------|------------|
| s_…1142 | 26 | 0 | 88 | EXP-130: Few-Shot Discovery |
| s_…1096 | 20 | 0 | 60 | EXP-128: Channel 3 Boundary |
| s_…884 | 18 | 0 | 188 | EXP-117: Bob FM-2.6 |
| s_…1040 | 17 | 0 | 91 | EXP-127: Channel Separation |
| s_…100 | 13 | 0 | 35 | EXP-129: Budget Curve |
| s_…1183 | 11 | 0 | 39 | EXP-131: Gate Stacking |

**Typical pattern** (from s_1775850878014_1040):
```
[8]  gym-run.sh contradictory-requirements --agent coder --timeout 5  # B1
[9]  gym-run.sh contradictory-requirements --agent coder --timeout 5  # B2
[10] gym-run.sh contradictory-requirements --agent coder --timeout 5  # B3
[11] gym-run.sh contradictory-requirements --agent coder --timeout 5  # B4
[12] gym-run.sh contradictory-requirements --agent coder --timeout 5  # B5
[13] gym-run.sh contradictory-requirements --agent coder --timeout 5  # B6
    ... then 6 more for treatment arm, then 6 for arm C = 18 runs total
```

**What gym-batch.sh supports**: `scripts/gym-batch.sh --scenario contradictory-requirements --agent coder --variants baseline,ch1,ch3-fewshot --trials 6` — a single command replacing 18 calls.

**Root cause**: Coach's heartbeat.md and work session templates don't reference gym-batch.sh. The coach learned gym-run.sh from examples and never discovered the batch alternative.

**Savings**: 193 → ~20 calls (one gym-batch per experiment arm). **~173 ops/day saved**.

### Pattern 2: DB Schema Discovery Spirals (276 + 142 = 418 DB calls)

**The problem**: Coach starts sessions by probing database schema before it can run queries. In the worst case (s_1775825744294_884), the first **15 consecutive ops** are:

1. Query `may.db` → empty (wrong path)
2. List tables → empty
3. Query evaluations → empty
4. Check bob data → empty
5. Check agents → empty
6. Check row counts → empty
7. `find *.db` → discover `.state/may.db` exists
8. Open `.state/may.db` → has data!
9. PRAGMA table_info → learn schema
10. Query sessions for bob → now can actually work
11-15. More schema probes for other tables

This "where is the data? what are the columns?" sequence repeats across sessions because coach has no persistent memory of the DB path or schema.

**Sub-pattern: Convention drilling** (142 ops): Escalating convention_checks queries that progressively narrow down (overall rates → per-agent → per-convention → per-session → hourly trends). Observed in heartbeat sessions: up to 16 convention queries in a single session.

**Evidence** (consecutive DB runs ≥3):

| Session | Run Length | Type |
|---------|-----------|------|
| s_…884 | 7 consecutive | DB path discovery |
| s_…957 | 7 consecutive | Schema + convention |
| s_…884 | 6 consecutive | Session queries |
| s_…1300 | 4+4+4 consecutive | Convention drilling |

**Root cause**: 
- DB path (`agents/.state/may.db` → `.state/may.db`) is not in coach's context.md
- No pre-built query functions for common patterns
- Convention dashboard doesn't exist as a tool

**Savings estimate**: 
- Path/schema knowledge in context.md: saves ~5 ops per session × 80 sessions = **~400 ops/day**
- Convention dashboard tool: saves ~8 ops per heartbeat × 10 convention-checking heartbeats = **~80 ops/day**

### Pattern 3: File Discovery + Inspection Chains (615 calls combined)

**The problem**: FILE_DISCOVERY (285) + FILE_INSPECT (330) = 615 ops spent on `ls`, `find`, `wc -l`, `head`, `tail` — exploring directory structures and file sizes before reading content. These come in bursts:

| Session | FILE_DISCOVERY consecutive | FILE_INSPECT bursts |
|---------|---------------------------|---------------------|
| s_…1226 (heartbeat) | 9 consecutive ls/find | 7 head/tail |
| s_…1300 (heartbeat) | 4 consecutive ls | 5 wc/head |
| s_…957 | 25 total discovery | 22 total inspect |

**Typical heartbeat pattern** (s_1775883219220_1226):
```
ls -lt agents/shared/knowledge/experiments/ | head -8
ls -la agents/shared/knowledge/experiments/EXP-133/
ls -la agents/shared/knowledge/experiments/EXP-133/results/
ls -la agents/gym/scenarios/ | head -20
wc -l agents/coach/todo.md
wc -l agents/coach/workspace/*.md
head -5 agents/coach/workspace/experiment-tracker.md
head -20 agents/coach/workspace/sprint-status.md
tail -10 agents/shared/knowledge/experiments/EXP-132/results/summary.md
```

**Root cause**: Same as prior finding — no state index. Coach must rediscover experiment status, scenario layouts, and workspace contents each session.

**Savings estimate**: State index → **~100 ops/day** (saving ~5 discovery ops per heartbeat × ~20 heartbeats/day).

### Pattern 4: GREP Chains (354 calls, 17 burst runs of ≥3)

**The problem**: GREP_SEARCH is the #1 bash category. Coach uses grep/rg in long chains of 4-8 consecutive calls, gradually narrowing searches:

1. Broad: `grep -rl "pattern" agents/` — which files?
2. Narrow: `grep -n "pattern" specific-file.ts` — which lines?
3. Context: `grep -A 10 "pattern" file.ts` — surrounding code?
4. Cross-ref: `grep -rn "related-pattern" src/` — related usage?

**Worst case**: 8 consecutive grep calls in s_1775838368441_957 (EXP-123 investigation).

| Burst Metric | Value |
|-------------|-------|
| Total burst runs (≥3 consecutive) | 17 |
| Max burst length | 8 |
| Average burst length | 4.1 |
| Total ops in bursts | 70 |

**Root cause**: No structured code search tool. Each grep call returns raw text that requires another grep to narrow down.

**Savings estimate**: A code-search wrapper that returns matches with file context in one call would collapse 4-call chains to 1: **~60 ops/day**.

### Pattern 5: Gym Results Polling (211 GYM_QUERY calls)

**The problem**: After submitting gym runs, coach queries the gym_runs and gym_checks tables repeatedly to check results. In s_1775867092608_1142, there are 24 gym-query calls — many are the same query re-run because the agent is checking if async runs completed. `gym-stats.ts` exists (used in only 3 of 80 sessions) and provides formatted output, but coach writes raw SQL instead.

**Evidence** (from s_1775867092608_1142):
```
[27] node -e "...gym_runs WHERE scenario LIKE '%kb-integration%'..."
[28] bun -e "...gym_runs WHERE scenario LIKE 'kb-integration%'..."  
[29] node -e "...gym_runs WHERE scenario LIKE '%kb-integration%'..."  # same query, different runtime
[50] node -e "...gym_runs WHERE scenario LIKE '%kb-integration%'..."  # again
[56] node -e "...gym_runs WHERE scenario LIKE 'kb-integration%'..."  # again
[62] node -e "...gym_runs WHERE scenario LIKE 'kb-integration%'..."  # again
```

Six identical queries because the agent doesn't know gym-run.sh records results synchronously — it keeps checking as if runs are async.

**Root cause**: 
- Coach doesn't know `gym-stats.ts` exists (only 3/80 sessions use it)
- Coach sometimes uses `node -e "require('better-sqlite3')..."` which doesn't work (wrong import), then switches to `bun -e "import from 'bun:sqlite'..."` — wasting 2+ ops on runtime confusion

**Savings estimate**: Using gym-stats.ts + understanding sync execution: **~100 ops/day**.

---

## Existing Tool Adoption Scorecard

| Tool | Exists | Used (24h) | Expected Use | Adoption Rate |
|------|--------|------------|--------------|---------------|
| `gym-batch.sh` | ✅ | 1 call | ~20/day | **0.5%** |
| `gym-stats.ts` | ✅ | 3 sessions | ~40/day | **~7.5%** |
| `session-query.ts` | ✅ | 1 session | ~10/day | **~1.3%** |
| `gym-run.sh` | ✅ | 193 calls | ~20/day | **965%** (overused) |

**The core issue isn't missing tools — it's tool awareness.** The batch runner, stats reporter, and session query tools all exist but coach doesn't use them.

---

## Aggregate Savings Estimate

| Pattern | Ops/Day (Current) | Ops/Day (With Tools) | Savings | Difficulty |
|---------|-------------------|---------------------|---------|------------|
| Manual Gym Runs → gym-batch | 193 | ~20 | **173** | Easy — add to coach context.md |
| DB Discovery Spirals | ~418 | ~200 | **~218** | Easy — add DB path + schema to context |
| File Discovery/Inspect | ~615 | ~515 | **~100** | Medium — build state index |
| GREP Chains | ~354 | ~294 | **~60** | Medium — code search wrapper |
| Gym Results Polling | ~211 | ~110 | **~101** | Easy — add gym-stats to context.md |
| **Total** | **~1,791** | **~1,139** | **~652** | |

**Total estimated savings: ~652 ops/day (29% of bash ops, 22% of all coach ops)**

---

## Recommended Actions (Priority Order)

### 1. Add Tool Awareness to Coach Context (saves ~374 ops/day)

**Zero-code change.** Add to `agents/coach/context.md`:
```
- Database is at .state/may.db (NOT may.db, NOT agents/.state/may.db)
- Use `bun scripts/gym-stats.ts --scenario <name>` to check gym results (not raw SQL)
- Use `scripts/gym-batch.sh --scenario X --variants a,b --trials N` for experiment trials (not individual gym-run.sh calls)  
- Use `bun scripts/session-query.ts` to search sessions (not raw DB queries)
- bun:sqlite is the DB driver (not better-sqlite3, not require())
```

This single context update addresses Patterns 1, 2 (partially), and 5.  
**Effort**: 5 minutes. **Impact**: Highest ROI change available.

### 2. Convention Dashboard Script (saves ~80 ops/day)

Build `scripts/convention-dashboard.ts` that outputs:
- Pass rates by convention + agent
- Trend over last 24h (hourly buckets)  
- Failing sessions with violation summaries
- Maturity scores

Collapses 6-16 convention queries per heartbeat into 1 command.

### 3. Coach State Index (saves ~100 ops/day)

Maintain `agents/coach/workspace/state-index.md` listing:
- Active experiments and their status
- Pending gym runs and recent results
- Current sprint items
- Dirty flags for what changed since last heartbeat

Coach updates this at end of each productive session; reads it at start instead of doing 9+ ls/find calls.

### 4. Structured Code Search Wrapper (saves ~60 ops/day)

`scripts/code-search.sh --pattern "pattern" --scope src/ --context 5` that returns matches with file paths, line numbers, and context in a structured format.

---

## Comparison with Prior Findings

| Metric | Apr 10 (full history) | Apr 11 (6h window) | Apr 11 (24h, this finding) |
|--------|----------------------|--------------------|-----------------------------|
| Bash % of ops | 64% (top 15 sessions) | 88.2% (18 sessions) | **74.6%** (80 sessions) |
| Top waste pattern | File discovery (32.7%) | GREP (26.5%) | **GREP (15.9%)** |
| Gym runs per session | Up to 26 | Not focused | Up to 26, 193 total/24h |
| gym-batch adoption | Not measured | Not measured | **0.5%** (1/193) |
| Estimated savings | ~750 ops/day | ~164 ops/6h | **~652 ops/day** |

The key **new insight** not in prior findings: the tools already exist. The savings don't require building new tools — they require getting the coach to use existing ones. Adding 5 lines to `context.md` is the highest-ROI intervention.


[SIG: 1775904850:coach-tool-gap]
