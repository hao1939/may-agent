# EXP-140 Results: Agent Read Patterns Observational Study

> **Date**: 2026-04-11 | **N**: 353 sessions, 1,543 read events, 7,938 total tool calls
> **Status**: COMPLETE ✅

## Executive Summary

**Agents are overwhelmingly action-heavy**: 96% of sessions have more bash/write/edit calls than reads. The median session makes only 3 reads. However, **37.8% of all reads are duplicates** — the same file read multiple times within one session. Bob is the worst offender (46% of his sessions have duplicate reads, averaging 4 duplicates per affected session). Five files account for 30% of all reads, suggesting agents are locked into repetitive navigation patterns.

### Key Findings

| Finding | Data | Implication |
|---------|------|-------------|
| **96% action-heavy** | Reads are 16% of tool calls; bash is 62% | Agents don't over-read — they under-read if anything |
| **37.8% duplicate reads** | 584 of 1,543 reads are re-reads of same file | ~1,168 tokens/session wasted on duplicate context |
| **Top 5 files = 30% of reads** | dispatch-board, todo×3, INDEX.md | Navigation is concentrated, not exploratory |
| **Bob: 140 duplicate reads** | INDEX.md 47x, PRIORITY-TRACKER 47x, todo 46x | Bob re-reads his navigation files every cycle within sessions |
| **May: dispatch-board 3.7×/session** | 121 reads across 33 sessions | May re-reads dispatch after every dispatch action |
| **62% of sessions have errors** | 639 errors total, 1.8/session mean | Errors common but low-rate per session |
| **Evaluator reads heartbeat 27% of time** | 24/89 reads are heartbeat.md | Evaluator re-reads instructions it already has |

---

## Q1: What Do Agents Actually Read?

### Tool Call Distribution (N=7,938)

| Tool | Count | % |
|------|-------|---|
| bash | 4,917 | 61.9% |
| read | 1,276 | 16.1% |
| finish | 684 | 8.6% |
| edit | 631 | 7.9% |
| agents | 197 | 2.5% |
| write | 164 | 2.1% |
| checkpoint | 51 | 0.6% |
| workflow | 18 | 0.2% |

**Key insight**: `bash` dominates (62%), which makes sense — agents use bash for running tests, grepping, and executing commands. `read` at 16% is the second-most-common tool but far below bash.

### Reads Per Session

| Stat | Value |
|------|-------|
| min | 0 |
| p25 | 1 |
| median | 3 |
| p75 | 5 |
| p90 | 7 |
| max | 23 |
| mean | 3.6 |
| Zero-read sessions | 27 (7%) |

**Interpretation**: Most sessions read 1-5 files. Only 18% read 6+ files. 7% of sessions make zero explicit reads — these are likely heartbeat/check sessions that proceed directly to bash commands.

### Read Category Breakdown (N=1,543)

| Category | Count | % | Description |
|----------|-------|---|-------------|
| workspace | 617 | 40.0% | Agent workspace files (todo, journals, boards) |
| knowledge/skills | 514 | 33.3% | Shared KB entries, hypotheses, experiment results |
| heartbeat | 129 | 8.4% | Agent instruction files |
| source-code | 117 | 7.6% | `src/` production code |
| agent-files-other | 115 | 7.5% | Other files under `agents/` |
| other | 39 | 2.5% | Miscellaneous |
| state-files | 5 | 0.3% | `.state/` files |
| identity/soul | 5 | 0.3% | SOUL/common-sense files |
| agent-config | 1 | 0.1% | agent.json |

**Key insight**: 73% of reads are workspace + knowledge files. Only 8% are heartbeat re-reads (mostly evaluator and may). Source code reads are surprisingly low (7.6%) — agents don't often need to read code they're working on because they bash-grep instead.

### Top 25 Most-Read Files

| # | File | Reads | % |
|---|------|-------|---|
| 1 | dispatch-board.md | 124 | 8.0% |
| 2 | scout/workspace/todo.md | 108 | 7.0% |
| 3 | bob/workspace/todo.md | 94 | 6.1% |
| 4 | shared/knowledge/INDEX.md | 72 | 4.7% |
| 5 | PRIORITY-TRACKER.md | 71 | 4.6% |
| 6 | qa/workspace/journal.md | 64 | 4.1% |
| 7 | optimizer/workspace/todo.md | 57 | 3.7% |
| 8 | evaluator/periodic-tasks.md | 33 | 2.1% |
| 9 | H-098...md | 28 | 1.8% |
| 10 | evaluator/heartbeat.md | 24 | 1.6% |

**Concentration**: Top 5 files = 30% of all reads. Top 10 = 43%. Top 25 = 61%. Only 257 unique files were read across 353 sessions.

---

## Q2: Read-to-Action Ratio

### Overall Ratio
- **Mean**: 20.8% (reads / [reads + writes + edits + bash])
- **Median**: 20.0%

### Session Classification
| Type | Sessions | % |
|------|----------|---|
| Action-heavy (actions > reads) | 340 | 96% |
| Balanced (equal) | 7 | 2% |
| Read-heavy (reads > actions) | 6 | 2% |

**Interpretation**: Agents are overwhelmingly action-heavy. This is healthy — they read what they need, then act. The 6 read-heavy sessions are likely orientation/planning sessions.

---

## Q3: Reading Anti-Patterns

### Anti-Pattern 1: Duplicate Reads (MAJOR)

**37.8% of all reads (584/1,543) are re-reads of the same file within a single session.**

| Metric | Value |
|--------|-------|
| Total duplicate reads | 584 |
| Sessions with duplicates | 185 (52%) |
| Worst agent | Bob (46% of sessions have dups) |

**Bob's most duplicated files**:
| File | Duplicate reads |
|------|----------------|
| PRIORITY-TRACKER.md | 47× extra |
| INDEX.md | 47× extra |
| todo.md | 46× extra |
| H-098...md | 17× extra |
| H-099...md | 11× extra |

**Pattern**: Bob has a "navigate → read → act → navigate again" loop. He reads INDEX.md to find what to work on, reads the target file, does work, then reads INDEX.md again to find the next item — re-reading the same file he already has in context.

**May's pattern**: Reads dispatch-board.md 3.7×/session (121 reads across 33 sessions). The worst sessions read dispatch-board 7 times. May reads → dispatches → re-reads to check state → dispatches → re-reads.

**Cost estimate**: At ~1,000 tokens per read, 584 duplicate reads ≈ 584K tokens wasted. Over a week, this is substantial.

### Anti-Pattern 2: Heartbeat Re-Reads

Some agents re-read their heartbeat files which are already loaded via system prompt or context:

| Agent | Heartbeat reads | Total reads | % |
|-------|----------------|-------------|---|
| evaluator | 24 | 89 | **27%** |
| may | 24 | 169 | **14%** |
| qa | 16 | 151 | **11%** |
| tech-lead | 16 | 170 | **9%** |
| bob | 8 | 535 | 1% |
| optimizer | 6 | 139 | 4% |
| coach | 2 | 161 | 1% |
| scout | 0 | 121 | 0% |

**Evaluator** wastes 27% of its reads on heartbeat.md — instructions it already has in context. This is a pure efficiency loss.

### Anti-Pattern 3: Error Rate

| Metric | Value |
|--------|-------|
| Sessions with ≥1 error | 221 (62%) |
| Total errors | 639 |
| Mean errors/session | 1.8 |

**Worst offenders**:
| Agent | Session | Errors | Ops |
|-------|---------|--------|-----|
| bob | s_1775899503711_1335 | 18 | 67 |
| optimizer | s_1775906657148_1393 | 12 | 75 |
| coach | s_1775867092608_1142 | 12 | 88 |

**Note**: `isError:true` includes bash errors, not just read errors. The 62% rate seems high but many are expected (e.g., testing if a file exists, running tests that fail initially).

### Anti-Pattern 4: Context Overload

Sessions with >70% reads among ≥5 tool calls: **0** (0%). This anti-pattern does not exist — agents are never over-reading.

---

## Q4: Per-Agent Read Profiles

### Agent Comparison Table

| Agent | N | Mean ops | Reads/sess | Writes/sess | Bash/sess | Read% | Errors/sess |
|-------|---|----------|-----------|-------------|-----------|-------|-------------|
| **Bob** | 76 | 20 | 4.8 | 3.4 | 13.7 | 21% | 1.7 |
| **Optimizer** | 56 | 20 | 2.1 | 3.0 | 14.9 | 10% | 2.4 |
| **Coach** | 51 | 24 | 2.5 | 1.8 | 19.6 | 9% | 2.2 |
| **Tech-lead** | 36 | 26 | 4.9 | 1.6 | 22.4 | 16% | 2.1 |
| **Scout** | 34 | 14 | 3.9 | 1.6 | 10.4 | 24% | 0.6 |
| **QA** | 34 | 10 | 4.4 | 1.2 | 7.7 | 32% | 0.8 |
| **May** | 33 | 20 | 4.5 | 3.3 | 14.4 | 18% | 3.4 |
| **Evaluator** | 32 | 6 | 1.8 | 0.3 | 4.0 | 29% | 0.9 |

### Agent Personas

1. **QA** (highest Read%: 32%) — "The Reader". Makes the most reads relative to other actions. Reads journal.md 64 times across 34 sessions (1.9/session). Low errors.

2. **Evaluator** (29% Read%) — "The Re-Reader". Reads heartbeat 27% of time. Smallest sessions (6 ops mean). Most of its work is checking state.

3. **Scout** (24% Read%) — "The Todo Checker". Reads todo.md 107 times across 34 sessions (3.1/session). Low errors, efficient sessions.

4. **Bob** (21% Read%, highest absolute reads) — "The Navigator". Most reads total (535), most duplicates (140+ extra). Caught in navigate-read-act-navigate loops.

5. **May** (18% Read%, highest error rate) — "The Dispatcher". Reads dispatch-board.md 3.7×/session. High error rate (3.4/session) likely from managing complex dispatch operations.

6. **Tech-lead** (16% Read%) — "The Code Reader". Reads heartbeat + source code (manager.ts 14×, cron.ts 10×). Balanced profile.

7. **Optimizer** (10% Read%) — "The Bash-er". Lowest read rate, highest bash% (72%). Almost never reads — jumps straight to action.

8. **Coach** (9% Read%) — "The Analyst". Lowest read rate alongside optimizer, but highest bash% (78%). Runs analysis scripts instead of reading files.

---

## Q5: Read Volume Correlations

### By Read Volume Group

| Group | N | Mean ops | Mean errors | Mean bash | Mean writes+edits |
|-------|---|----------|------------|-----------|-------------------|
| Low (0-1 reads) | 100 (28%) | 11.3 | 1.06 | 9.2 | 0.6 |
| Med (2-5 reads) | 188 (53%) | 17.2 | 1.78 | 13.3 | 2.0 |
| High (6+ reads) | 65 (18%) | 33.5 | 3.06 | 23.1 | 5.5 |

**Pattern**: More reads correlates with larger sessions overall (more ops, more writes, more bash, more errors). Reading isn't displacing action — it's a marker of session complexity.

### Heartbeat vs. Work Sessions

| Type | N | Mean reads |
|------|---|-----------|
| Heartbeat (≤10 ops) | 152 | 2.1 |
| Work (>10 ops) | 201 | 4.8 |

Work sessions read 2.3× more than heartbeat sessions, as expected.

---

## Actionable Recommendations

### Priority 1: Reduce Bob's Duplicate Reads (140+ wasted reads)

**Problem**: Bob re-reads INDEX.md, PRIORITY-TRACKER.md, and todo.md multiple times per session in a navigate-act-navigate loop.

**Solution options**:
1. **Read dedup guard enhancement**: The existing `createReadDedupGuard` should already catch this — investigate why it's not working for Bob
2. **Workspace summary injection**: Pre-compute a "workspace state" summary and inject into Bob's context, reducing need to re-navigate
3. **Session-level caching**: If Bob reads INDEX.md at turn 3, serve cached content at turn 15 instead of re-reading

### Priority 2: Reduce May's Dispatch-Board Re-Reads (121 reads, 3.7/session)

**Problem**: May reads dispatch-board.md after every action to check state changes.

**Solution**: May could maintain an in-context "dispatch state" variable instead of re-reading the file. Or the dispatch-board could be auto-injected into May's context.

### Priority 3: Stop Evaluator Heartbeat Re-Reads (27% of reads)

**Problem**: Evaluator reads heartbeat.md in 24/89 reads despite it being in context.

**Solution**: Add heartbeat.md to evaluator's system prompt or auto-inject, and add a guard that warns "this file is already in your context — don't re-read it."

### Priority 4: Investigate Read Dedup Guard Effectiveness

**Problem**: `createReadDedupGuard` exists in the binary but 52% of sessions still have duplicate reads. Either the guard has a bug, an exception, or it counts "read with different offset/limit" as non-duplicate.

**Action**: Tech-lead should audit `createReadDedupGuard` logic to understand why Bob can read INDEX.md 6× in one session.

---

## Hypotheses Generated

### H-140a: Read dedup guard has path-matching exceptions
The existing guard may use exact argument matching (path + offset + limit), not just path matching. Bob's duplicate reads may use different `offset` or `limit` params, bypassing dedup.

### H-140b: Workspace state injection could reduce reads 30%
If the top 5 most-read files were auto-injected as compressed summaries, we'd eliminate ~469 reads (30% of total).

### H-140c: Scout's todo.md reads are a read-check-act cycle (not waste)
Scout reads todo.md 3.1×/session — but this may be intentional check-and-mark behavior, not redundancy. Needs investigation.

---

## Limitations

1. **Recency bias**: Only analyzed 353 recent sessions, not the full 2,602 archive
2. **No read content analysis**: We know WHAT files were read but not HOW MUCH of each file (no offset/limit data extracted)
3. **Error attribution**: `isError:true` counts all tool errors, not just read errors
4. **Session quality correlation**: We didn't correlate read patterns with session quality (would need evaluation data, which is currently empty in may.db)
5. **Causality**: Cannot determine if more reads → better quality or if complex tasks → more reads + more quality effort

---

## Knowledge Entry

→ **KE-140**: Agent read patterns are action-heavy (96% of sessions). The main waste is duplicate reads (37.8% of all reads), concentrated in Bob (navigate-act-navigate loops) and May (dispatch-board re-reads). Five files account for 30% of all reads. Heartbeat re-reads are a secondary waste (evaluator: 27% of reads).
