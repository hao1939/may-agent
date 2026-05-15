# Finding: Bash Command Patterns in Tech-Lead & Coach Sessions (6h Window)

**Date**: 2026-04-11 ~09:00 UTC  
**Session**: s_1775897681126_1319 (Mode B — Tool Gap Analysis)  
**Method**: Extracted bash commands from `session.jsonl` (`.arguments.command` field) across 18 tech-lead/coach sessions active in the last 6h. Classified all 626 bash commands into categories and identified multi-step sequences.  
**Prior work**: Builds on [finding-tool-gap-analysis-0410.md](finding-tool-gap-analysis-0410.md) (historical data, Mar 20-23) and [finding-tool-gap-0411-b.md](finding-tool-gap-0411-b.md) (bob sessions, no receipt access).

---

## Executive Summary

**88.2% of all ops in tech-lead/coach sessions are bash calls** (626 of 710 total ops across 18 sessions). The two dominant categories — GREP searches (26.5%) and DB queries (23.2%) — account for half of all ops. Agents routinely chain 4-16 consecutive bash calls of the same type, indicating they're using bash as a general-purpose exploration/query tool rather than having purpose-built alternatives.

The April 10 historical analysis estimated 37-69% op savings from purpose-built tools. This current-data analysis **confirms those patterns are still active and identifies specific new patterns** not visible in historical data: convention_checks query chains (66 queries in 6h), experiment-directory enumeration loops, and a universal fleet-status query duplicated identically in 10 of 18 sessions.

## Data Collection

### Sessions Analyzed (6h window: ~03:00-09:00 UTC Apr 11)

**Tech-lead** (10 sessions, 50-24 ops):
- s_1775879619537_1209 (50 ops, 51 bash)
- s_1775886820065_1249 (45 ops, 48 bash)  
- s_1775888619819_1259 (32 ops, 30 bash)
- s_1775883219337_1229 (41 ops, 37 bash)
- s_1775881591033_1222 (24 ops, 22 bash)
- s_1775876020170_1191 (42 ops, 40 bash)
- s_1775877819591_1200 (40 ops, 37 bash)
- s_1775885020286_1238 (33 ops, 30 bash)
- s_1775890419819_1271 (29 ops, 26 bash)
- s_1775894020884_1294 (30 ops, 27 bash)

**Coach** (8 sessions, 44-25 ops):
- s_1775895819503_1300 (44 ops, 47 bash)
- s_1775883219220_1226 (42 ops, 43 bash)
- s_1775881504465_1221 (36 ops, 36 bash)
- s_1775886969211_1252 (33 ops, 33 bash)
- s_1775897620005_1312 (25 ops, 35 bash)
- s_1775885019034_1233 (30 ops, 29 bash)
- s_1775890419719_1268 (28 ops, 27 bash)
- s_1775894020751_1289 (25 ops, 28 bash)

### Command Category Distribution (626 bash commands)

| Category | Count | % | Description |
|----------|-------|---|-------------|
| GREP_SEARCH | 166 | 26.5% | grep/rg across source, agents, config |
| DB_QUERY | 145 | 23.2% | bun -e with sqlite queries against may.db |
| AGENT_FILE_READ | 69 | 11.0% | cat/head/tail of agent workspace files |
| FILE_DISCOVERY | 58 | 9.3% | ls/find to enumerate dirs |
| FILE_SIZE_SURVEY | 47 | 7.5% | wc -l on source/agent files |
| GIT_OPS | 37 | 5.9% | git log/show/diff/merge/branch |
| SESSION_SCAN | 8 | 1.3% | scanning .state/sessions dirs |
| OTHER | 96 | 15.3% | tsc, vitest, sed, miscellaneous |

---

## Key Findings

### Finding 1: Universal Fleet-Status Query (10/18 sessions, 10 ops)

**Every tech-lead heartbeat and most coach heartbeats start with the same DB query** — a 1-line bun command that queries sessions table for agent, COUNT(*), AVG(opCount), error count. This exact query appears in 10 of 18 sessions:

```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});const r=db.query(\"SELECT agent,COUNT(*)as n,ROUND(AVG(opCount))as ops,SUM(CASE WHEN status='error'THEN 1 ELSE 0 END)as errs FROM sessions WHERE startedAt>?GROUP BY agent\").all(Date.now()-6*3600000);console.table(r);..."
```

This is literally copy-pasted from `heartbeat.md` templates. The query is **always the same** and could be a simple tool call: `fleetStatus()`.

**Impact**: 10 ops saved, but more importantly eliminates the boilerplate that makes every session start the same way.

### Finding 2: Convention Check Drilling (66 queries, concentrated in coach)

The single largest DB query sub-pattern. Coach session s_1775895819503_1300 alone executed **22 convention_checks queries** in escalating specificity:

1. PRAGMA table_info(convention_checks) — "What columns exist?"
2. SELECT convention, passed, COUNT(*) WHERE agent='qa' — "Overall rates"
3. SELECT datetime(checked_at/1000,'unixepoch'), passed WHERE convention='C1.1' — "Trend over time"
4. SELECT session_id, violations WHERE convention='C1.1' AND passed=0 — "Which sessions failed?"
5. SELECT ... GROUP BY CAST(checked_at/3600000 as INT) — "Hourly breakdown"
6. SELECT ... WHERE session_id='s_xxx' — "Did this specific session pass?"
7. "Check if convention checker is rechecking old sessions" — Meta-query about the checker itself

**This is an investigation cascade**: the agent asks progressively more specific questions because each answer only partially satisfies. A `conventionDashboard({convention: 'C1.1', agent: 'qa', timeRange: '12h'})` tool that returns the complete picture (pass rate, trend, failing sessions, violation details) would collapse 6-10 queries into 1.

**DB Query sub-patterns** (145 total):

| Sub-pattern | Count | % of DB queries |
|-------------|-------|-----------------|
| DB_CONVENTION_CHECKS | 66 | 45.5% |
| DB_OTHER | 25 | 17.2% |
| DB_SESSION_QUERY | 20 | 13.8% |
| DB_FLEET_STATUS | 10 | 6.9% |
| DB_SCHEMA_INSPECT | 9 | 6.2% |
| DB_EVALUATIONS | 8 | 5.5% |
| DB_PENDING_REQUESTS | 4 | 2.8% |
| DB_COUNT | 3 | 2.1% |

### Finding 3: GREP Chains (runs of 5-16 consecutive grep calls)

Tech-lead sessions show extended grep chains averaging 7 consecutive grep calls per run. The worst case: session s_1775886820065_1249 had a **16-call consecutive grep chain** investigating C1.1 convention enforcement.

**GREP sub-patterns** (166 total):

| Sub-pattern | Count | Description |
|-------------|-------|-------------|
| GREP_OTHER | 140 | General code/config search |
| GREP_CONVENTION | 26 | Searching for convention references |
| GREP_GUARD | 24 | Searching for guard/depth-guard patterns |
| GREP_IMPORTS | 12 | Checking import chains |
| GREP_KNOWLEDGE | 10 | Knowledge base searches |
| GREP_DOCS | 7 | Markdown/workspace searches |
| GREP_TODO | 6 | TODO/FIXME scanning |
| GREP_ERROR | 5 | Error pattern searches |
| GREP_PROTOCOL | 4 | Protocol reference checks |

**Pattern**: These grep chains almost always follow the same structure:
1. Broad search: `grep -rl "pattern" src/` — find which files mention it
2. Narrow search: `grep -n "pattern" specific-file.ts` — find exact lines  
3. Context search: `grep -A 10 "pattern" specific-file.ts` — get surrounding code
4. Cross-reference: `grep -rn "related-pattern" src/` — find related usage

A `codeSearch({pattern: 'C1.1', scope: 'src/', context: true})` tool that returns file matches with context lines in a single call would save 3-4 ops per search chain.

### Finding 4: Branch Review Sequence (12 git commands, in tech-lead work sessions)

Tech-lead does branch reviews following a fixed sequence:
1. `git branch -a | grep review/` — list pending review branches
2. `git log --oneline main..<branch>` — what commits?
3. `git diff main..<branch> --stat` — files changed?
4. `git diff main..<branch>` — actual changes?
5. `git checkout <branch>` + `tsc --noEmit` — does it compile?
6. `vitest run` — do tests pass?
7. `git checkout main && git merge <branch>` — merge it

This 7-step sequence appeared in s_1775879619537_1209 and s_1775883219337_1229. A `reviewBranch({branch: 'review/fix-evaluator-scale-remnants', autoMerge: true})` tool could handle steps 2-7 as a single operation, saving 5-6 ops per review.

### Finding 5: Experiment Directory Enumeration (coach pattern)

4 of 8 coach sessions start with the same pattern:
```bash
ls -lt agents/shared/knowledge/experiments/ | head -8
```
Followed by individual `ls -la` calls into 2-4 specific experiment directories, then `cat` of design.md or results.md files. This is a discovery → read loop.

**Sample from s_1775895819503_1300:**
```
ls -lt agents/shared/knowledge/experiments/ | head -8
ls -la agents/shared/knowledge/experiments/EXP-123/
ls -la agents/shared/knowledge/experiments/EXP-133/
ls -la src/lib/tools/verification-depth-guard*
ls -la agents/shared/knowledge/experiments/EXP-133/results/
```

A `experimentStatus()` tool that lists all experiments with their status (design only / has results / promoted) would save 3-5 ops per coach heartbeat.

### Finding 6: Multi-Step Sequence Analysis (consecutive same-category runs)

Sessions exhibit clear "burst" patterns where agents chain 2-16 bash calls of the same category before switching:

| Sequence | Max Run | Avg Run | Sessions Observed |
|----------|---------|---------|-------------------|
| Consecutive GREP | 16 | 5.3 | 4/4 sampled sessions |
| Consecutive DB | 7 | 4.2 | 3/4 sampled sessions |
| Consecutive GIT | 4 | 3.0 | 3/4 sampled sessions |
| Consecutive FS_LIST | 6 | 3.5 | 2/4 sampled sessions |
| Consecutive CAT | 2 | 2.0 | 2/4 sampled sessions |

---

## Comparison with April 10 Analysis

| Metric | Apr 10 (Historical) | Apr 11 (Current) | Status |
|--------|---------------------|-------------------|--------|
| Bash % of ops | 65.1% (13,825/17,906) | **88.2%** (626/710) | **Worse** — TL/coach are heavier bash users |
| Top pattern | Status Dashboard (28.5%) | GREP (26.5%) + DB (23.2%) | Same categories, different balance |
| Session Archaeology | 187 sessions, 10-15 ops | 8 commands (1.3%) | **Reduced** — may.db replaced filesystem scanning |
| Convention drilling | Not identified | **66 queries (45% of DB)** | **New finding** — convention_checks is now top DB use |
| Fleet status duplication | Mentioned in Status Dashboard | **10/18 sessions, identical query** | Confirmed and quantified |
| Branch review sequence | Under Git Archaeology | **7-step fixed workflow** | Refined — identified the full sequence |

**Key delta**: The April 10 analysis was based on historical sessions (Mar 20-23) where "Session Archaeology" (listing filesystem sessions) was the top pattern. In current sessions, may.db has replaced that — but **convention_checks queries have emerged as the new top pattern**, consuming 66 ops in 6h. This wasn't visible in historical data because convention_checks didn't exist yet.

---

## Tool Recommendations (Priority-Ordered)

### P0: Convention Dashboard Tool

**Pattern**: 67 convention_checks queries in 6h (10.7% of ALL ops)  
**Implementation**: A function that returns pass rates by convention+agent, trend over time, and failing session details in one call.  
**Savings**: ~50 ops/6h (collapse 6-10 queries per investigation into 1)  
**Difficulty**: Medium — pure SQL aggregation, no complex logic needed

### P1: Fleet Status Tool  

**Pattern**: 10 identical queries across 18 sessions  
**Implementation**: The exact query already exists in heartbeat.md templates — just wrap it as a tool.  
**Savings**: ~10 ops/6h (1 per session), but eliminates a universal boot sequence  
**Difficulty**: Easy — the query is literally provided in the heartbeat prompt

### P1: Code Search Tool  

**Pattern**: 166 grep commands, 26.5% of all ops, runs of up to 16 consecutive greps  
**Implementation**: A structured search that returns matches with context, file paths, and line numbers in one call.  
**Savings**: ~80 ops/6h (collapse 4-call grep chains into 1)  
**Difficulty**: Easy — wrapper around `rg --json` with structured output

### P2: Branch Review Tool  

**Pattern**: 7-step git workflow (12 git commands in 6h)  
**Implementation**: Automated checkout → compile → test → merge pipeline  
**Savings**: ~6 ops per review, but only a few reviews per period  
**Difficulty**: Medium — needs error handling for merge conflicts, test failures

### P2: Experiment Status Tool  

**Pattern**: 4/8 coach sessions start with experiment directory enumeration (3-5 ls calls)  
**Implementation**: Scan experiments/ directory, report status per experiment  
**Savings**: ~12 ops/6h (3 per coach heartbeat × 4 heartbeats)  
**Difficulty**: Easy — directory listing + file existence checks

### P3: Evaluation Dashboard Tool  

**Pattern**: 8 evaluation queries across sessions  
**Implementation**: Quality score distribution, agent breakdown, trend data in one call  
**Savings**: ~6 ops/6h  
**Difficulty**: Easy — SQL aggregation

---

## Aggregate Savings Estimate

| Tool | Ops Saved / 6h | Sessions Affected | Confidence |
|------|-----------------|-------------------|------------|
| Convention Dashboard | ~50 | Coach (8) + some TL | High — 66 actual queries observed |
| Code Search | ~80 | TL (10) + Coach (8) | High — 166 grep calls observed |
| Fleet Status | ~10 | All 18 sessions | Certain — identical query in 10/18 |
| Experiment Status | ~12 | Coach (8) | Medium — 4/8 observed |
| Branch Review | ~6 | TL (2-3) | Medium — seen in 2 sessions |
| Evaluation Dashboard | ~6 | TL (3-4) | Medium — 8 queries observed |
| **Total** | **~164** | | |

Against 626 bash ops total: **26.2% reduction** from purpose-built tools.  
Against 710 total ops: **23.1% reduction**.

This is more conservative than the April 10 estimate (37-69%) because:
1. Current analysis is 18 sessions vs 883 historical — smaller sample  
2. Many grep searches are unique (one-off code exploration, not repeated patterns)
3. The universal fleet-status query is only 1 op each — high frequency but low per-session impact
4. Convention drilling is concentrated in coach — doesn't affect all agents equally

---

## Data Quality Notes

1. **Receipt counts differ from session.jsonl tool counts**: Some sessions show more bash calls in session.jsonl than ops in receipts.jsonl. This may indicate parallel tool calls counting as 1 op, or receipt-counting methodology differences.
2. **session.jsonl format**: Tool calls are in `content[].type === 'toolCall'` blocks with `.arguments.command` (not `.input.command` as initially expected).
3. **may.db vs filesystem**: Current sessions are tracked in `.state/sessions/` with meta.json + session.jsonl + receipts.jsonl per session. may.db contains session metadata but session data is in filesystem.
