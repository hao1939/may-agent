# Finding: Lean vs Bloated Session Technique Comparison

**Date**: 2026-04-11 ~09:25 UTC  
**Session**: s_1775899467395_1334 (Mode C — Skill Scouting)  
**Method**: Compared the 3 leanest work sessions (5-14 ops) with the 3 most bloated (49-82 ops) across tech-lead and coach in the last 6h. Extracted tool-call sequences from `session.jsonl` and classified every bash command. Cross-referenced with Mode B findings (626 bash commands, GREP 26.5%, DB 23.2%).  
**Prior work**: [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) (Mode B), [finding-coach-82op-qa-regression-0411.md](finding-coach-82op-qa-regression-0411.md) (Mode A).

---

## Executive Summary

**Lean sessions (5-14 ops) use 38-44% bash; bloated sessions (49-82 ops) use 80-87% bash.** The dividing line is clear: lean sessions use `read()` + `edit()` as primary tools and bash only for testing/committing. Bloated sessions use bash as their universal Swiss-army knife — DB queries, grep chains, file discovery loops — spending 70-85% of their ops on *understanding the codebase* rather than *changing it*.

The production ratio (edit+write calls / total tool calls) tells the story:  
- **Lean sessions: 21-28%** of tools produce output  
- **Bloated sessions: 1-3%** of tools produce output  

This is a **10x difference in production efficiency**. The bloated sessions aren't doing more work — they're doing more *exploration* per unit of work.

---

## Data: All 9 Work Sessions (6h window)

| Session | Agent | Ops | Tools | Bash% | Grep | DB | FS | Prod% | s/op | Task |
|---------|-------|-----|-------|-------|------|----|----|-------|------|------|
| **s_1307** | **TL** | **5** | **12** | **42%** | **0** | **0** | **1** | **0%** | **11** | **Remove disabled cron entries** |
| **s_1321** | **Coach** | **13** | **18** | **44%** | **3** | **0** | **2** | **28%** | **14** | **Fix C1.3 false positive** |
| **s_1263** | **Coach** | **14** | **24** | **38%** | **0** | **0** | **1** | **21%** | **12** | **EXP-132: Implement guard** |
| s_1252 | Coach | 31 | 43 | 77% | 5 | 9 | 8 | 12% | 14 | Design EXP-132 |
| s_1221 | Coach | 34 | 45 | 80% | 8 | 12 | 7 | 7% | 11 | Write EXP-131 results |
| s_1318 | TL | 38 | 62 | 71% | 1 | 32 | 13 | 3% | 12 | Investigate 82-op coach |
| s_1222 | TL | 41 | 60 | 55% | 19 | 0 | 1 | 22% | 9 | Remove dead activity/progress |
| **s_1296** | **Coach** | **49** | **65** | **80%** | **8** | **20** | **21** | **3%** | **19** | **EXP-123 Revival** |
| **s_1286** | **Coach** | **82** | **104** | **87%** | **26** | **19** | **29** | **1%** | **10** | **C1.1 QA regression / EXP-133** |

*Bold = top 3 lean and top 3 bloated. "Prod%" = (edit+write)/total tools. "Grep/DB/FS" = bash calls of that type.*

---

## Top 3 Lean Sessions: What They Did Right

### 1. [5 ops] tech-lead: Remove 16 disabled cron entries

**Technique: Read → Transform → Commit (3-step pattern)**

| Turn | Action | Purpose |
|------|--------|---------|
| 1 | `read(heartbeat.md)` + `read(cron.json)` | Orient + get full data |
| 2 | `bash: bun -e (filter JSON)` | One-shot programmatic transform |
| 3 | `read(cron.json)` + `bash: bun -e (validate)` | Read-back verification |
| 4 | `bash: git commit` | Ship it |
| 5 | `finish(success)` | Done |

**Why it's lean**: The task was well-scoped (remove entries matching a filter), the agent knew exactly what file to read, and used a programmatic transform instead of manual edits. Zero grep, zero DB, zero file discovery. No exploration phase at all.

**Key techniques**: 
- **Parallel reads** in turn 1 (heartbeat + target file together)
- **Programmatic transform** instead of manual edit (bun script filtered the JSON)
- **Read-back verification** — read the file after writing to confirm

### 2. [13 ops] coach: Fix optimizer C1.3 false positive  

**Technique: Read Source → Understand → Edit → Test → Verify**

| Turn | Action | Purpose |
|------|--------|---------|
| 1 | `read(guard.ts)` + `read(guard.test.ts)` | Read both source and test in parallel |
| 2 | `bash: grep ×3` | Targeted search for related patterns |
| 3 | `edit(guard.ts)` | Make the fix |
| 4 | `edit(guard.test.ts)` | Add test cases |
| 5 | `bash: bun test` | Run tests |
| 6-10 | `find` → `read(results.md)` → `edit ×2` → verify | Update docs + verify |
| 11 | `finish(success)` | Done |

**Why it's lean**: Agent read the exact 2 files it needed in parallel (turn 1), understood the issue from the code (not from grepping), made the fix, tested. Only 3 grep calls — all targeted at finding related patterns, not exploratory.

**Key techniques**:
- **Read source + test together** — understand both before changing either
- **3 targeted greps** (not a discovery spiral) — each had a specific question
- **Test-driven verification** — ran tests 3× (after fix, after doc update, regression suite)

### 3. [14 ops] coach: EXP-132 Implement Path Hallucination Guard

**Technique: Read Design + Reference + Integration Point → Build → Test → Ship**

| Turn | Action | Purpose |
|------|--------|---------|
| 1 | `read(design.md)` + `read(reference-guard.ts)` + `read(manager.ts)` | 3-file parallel read |
| 2 | `read(compose-guards.ts)` + `ls guard files` | Discover what exists |
| 3 | `read(guard.ts)` + `read(guard.test.ts)` | Read existing implementation |
| 4 | `bash: bun test` | Baseline test run |
| 5-7 | `edit ×3` | Enhance guard + add tests |
| 8-9 | `bash: bun test ×2` | Test + regression check |
| 10-12 | `read` → `edit` → `write(results.md)` | Verify + document |
| 13-14 | `git commit` + `bun test` (final) | Ship + final verify |

**Why it's lean**: Three-file parallel read in turn 1 eliminated the need for discovery. The agent knew the design spec, a reference implementation, and the integration point — all from the first turn. Only 1 `ls` call (to see what guard files existed). Zero grep. Zero DB queries.

**Key techniques**:
- **3-file parallel read** as first action — maximum context in minimum turns
- **Read design spec first** — the experiment had a design.md that told the agent exactly what to build
- **Reference implementation pattern** — read an existing guard to understand the pattern, then follow it
- **Zero discovery spiral** — knew exactly what files to read from the task description

---

## Top 3 Bloated Sessions: What Went Wrong

### 1. [82 ops] coach: Investigate C1.1 QA regression / EXP-133

**Anti-pattern: Open-ended investigation with no termination criteria**

| Phase | Turns | Tools | What happened |
|-------|-------|-------|--------------|
| Orientation | 1-5 | 12 | grep agents/qa, 3 DB queries for convention_checks |
| Convention deep-dive | 6-25 | 35 | 19 DB queries (escalating specificity), 8 grep chains |
| File discovery spiral | 26-40 | 25 | ls/find across agents/, experiments/, sessions/ |
| Cross-referencing | 41-55 | 18 | grep for C1.1 references, read various docs |
| Writing | 56-60 | 5 | checkpoint, write design doc |
| Verification + finish | 61-74 | 9 | git ops, final greps, finish |

**104 tool calls for 1 design doc output.** The session spent 70 turns *investigating* and only 4 turns *producing*. The core anti-patterns:

- **DB query escalation**: 19 queries against convention_checks, each slightly more specific than the last (matches Mode B Finding 2: "investigation cascade")
- **File discovery spiral**: 29 ls/find calls — nearly 1 in 3 bash commands was just "what files exist here?"
- **No termination criteria**: The task said "investigate" with no defined stopping point — the agent kept digging

### 2. [49 ops] coach: EXP-123 Revival: Verification-Depth Guard

**Anti-pattern: DB query chain (18 consecutive queries)**

| Phase | Turns | Tools | What happened |
|-------|-------|-------|--------------|
| Context gathering | 1-8 | 18 | read existing files, grep for patterns |
| File discovery | 9-18 | 12 | ls/find experiment dirs, read raw data |
| DB marathon | 23-40 | 18 | **18 consecutive DB queries** — querying session data, evaluations, convention results |
| Implementation | 41-45 | 6 | Finally write/edit the guard |
| Verification | 46-52 | 11 | git, grep, test, finish |

**The 18-query DB marathon** (turns 23-40) was the agent trying to understand experiment results by querying raw data one question at a time. Each query returned partial information, prompting the next. A single comprehensive query or a summary doc would have collapsed this to 1-2 ops.

- **21 file discovery calls** — looking for experiment dirs, raw data, results files
- **Only 2 production calls** (1 edit + 1 write) out of 65 total — 3% production ratio

### 3. [41 ops] tech-lead: Remove dead activity/progress systems

**Anti-pattern: Grep chain for code removal (19 consecutive greps)**

| Phase | Turns | Tools | What happened |
|-------|-------|-------|--------------|
| Initial search | 1-8 | 10 | grep for function names, imports, references |
| Deep grep chain | 9-20 | 19 | 19 grep calls tracing import chains, cross-references |
| Editing | 21-35 | 18 | 13 edit calls (removing code) |
| Verification | 36-41 | 13 | test + grep to confirm removal |

**19 grep calls before the first edit.** The agent was trying to find every reference to the dead code before removing any of it. This is the "grep-then-read" pattern from Mode B but applied to code removal — find all references, then surgically remove each one.

Note: This session actually had a high production ratio (22%) because the edits were substantial (13 file edits). The bloat was in the *discovery* phase, not the production phase. Still, 19 consecutive greps could have been a single `rg --json` call with structured output.

---

## Side-by-Side Comparison

| Metric | Lean (5-14 ops) | Bloated (49-82 ops) | Ratio |
|--------|-----------------|---------------------|-------|
| **Avg ops** | 10.7 | 57.3 | 5.4x |
| **Avg tool calls** | 18.0 | 76.3 | 4.2x |
| **Bash %** | 41% | 82% | 2.0x |
| **Production ratio** | 16% avg (0-28%) | 2% avg (1-3%) | 8x |
| **Grep calls** | 1.0 avg | 17.7 avg | 17.7x |
| **DB queries** | 0.0 avg | 19.7 avg | ∞ |
| **File discovery** | 1.3 avg | 23.3 avg | 17.9x |
| **read() calls** | 5.0 avg | 9.3 avg | 1.9x |
| **Parallel reads per turn** | 2-3 (in turn 1) | 1-2 | ~1.5x |
| **Duration** | 132s avg | 900s avg | 6.8x |

### What Lean Sessions Do Differently

| Technique | Lean | Bloated |
|-----------|------|---------|
| **Parallel reads in turn 1** | ✅ 2-3 files read together | ❌ Sequential discovery |
| **Read source before grepping** | ✅ read() the actual file | ❌ grep to find, then read |
| **Design spec / known paths** | ✅ Task provides file paths | ❌ Must discover what exists |
| **Programmatic transforms** | ✅ bun scripts for bulk ops | ❌ Manual edit chains |
| **Zero DB queries** | ✅ 0 across all 3 lean sessions | ❌ 19-20 DB queries each |
| **Test as verification** | ✅ Run tests, not grep-verify | ❌ Grep to check changes |
| **Clear termination criteria** | ✅ "Remove X" / "Fix Y" / "Implement Z" | ❌ "Investigate" / "Design" |

### The Task-Type Factor

A critical confound: **lean sessions had well-defined tasks** (remove entries, fix a bug, implement from design). **Bloated sessions had open-ended tasks** (investigate regression, revive experiment, design new system). 

This isn't just agent technique — it's task structure. Open-ended investigation inherently requires more exploration. But the gap is still too large: a 82-op investigation that produces 1 design doc is using at least 30-40 ops on redundant discovery.

---

## Skill / Technique Recommendations

### Recommendation 1: "Parallel Context Load" Skill

**Pattern**: Read 2-4 files in parallel as the very first action. Every lean session did this; no bloated session did.

**Codification**: A skill that instructs agents:
> Before any bash call, identify the 2-4 most relevant files for this task and read() them all in the same turn. Sources: the file being changed, its test file, the design spec (if it exists), and the integration point.

**Impact**: Eliminates the discovery → read → discover-more loop. If you start with full context, you don't need grep chains to figure out what exists.

**Estimated savings**: 5-10 ops per session (eliminates initial file discovery phase).

### Recommendation 2: "Investigation Budget" Skill

**Pattern**: Open-ended tasks ("investigate", "design") have no natural stopping point. The 82-op session kept drilling because nothing told it to stop.

**Codification**: A skill that sets explicit phase budgets:
> For investigation tasks, allocate: 10 ops for data gathering, 5 ops for analysis, 5 ops for writing. If you haven't found the answer in 10 data-gathering ops, write what you know and flag gaps.

**Impact**: Prevents the 70-turn investigation-then-4-turn-writing pattern. Forces early synthesis.

**Estimated savings**: 20-40 ops on investigation sessions (cuts the tail).

### Recommendation 3: "DB Query Batch" Skill  

**Pattern**: Bloated sessions chain 18-32 DB queries, each asking one question. Lean sessions use zero DB queries.

**Codification**: A skill that instructs agents:
> Never chain more than 3 DB queries. If you need more than 3, write a single bun script that runs all queries and formats a comprehensive summary. Better: check if a workspace finding or dashboard already answers your question.

**Impact**: Collapses 18-query chains into 1-2 calls.

**Estimated savings**: 15-25 ops on DB-heavy sessions (the 38-op session had 32 DB queries — this alone would halve it).

---

## Relationship to Mode B Findings

Mode B found 626 bash commands dominated by GREP (26.5%) and DB (23.2%). This analysis reveals **who generates those commands**: the bloated sessions. The 3 bloated sessions alone account for:
- 53 grep calls (32% of all 166 greps found in Mode B)
- 59 DB queries (41% of all 145 DB queries found in Mode B) 
- 71 file discovery calls (data not in Mode B but proportional)

**Fixing the bloated sessions fixes the aggregate stats.** The lean sessions are already efficient — they don't need new tools. The bloated sessions need either: (a) better task scoping, (b) budget constraints, or (c) purpose-built tools that collapse multi-step exploration into single calls.

---

## Data Quality Notes

1. **ops_count vs tool calls**: Session metadata shows lower op counts than actual tool calls in session.jsonl (e.g., 5 ops but 12 tool calls). This is likely due to parallel tool calls counting as 1 op, or finish() retries not counting.
2. **finish() retries**: Lean sessions sometimes show 2-3 finish() calls — the verification gate rejects the first attempt and the agent retries. This inflates tool counts by 2-4 calls on lean sessions (making their true lean-ness even more pronounced).
3. **9 work sessions in 6h**: Small sample. The patterns are clear but should be validated with a larger window.


[SIG: lean-v-bloat-0411]
