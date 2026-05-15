# Finding: Tool Gap Analysis — Coach 98-op EXP-154 & Bob 84-op Bayesian Scorecard

**Date**: 2026-04-13 ~22:22 UTC  
**Window**: Sessions started ~21:53 UTC (both <2h old)  
**Method**: Extracted all tool calls from session.jsonl for both sessions. Classified bash commands and compared against known patterns from [Apr 11 bash-command-patterns](finding-bash-command-patterns-0411.md) and [Apr 13 PM tool-gap](finding-tool-gap-6h-0413b.md).

---

## Sessions Analyzed

| Session | Agent | Ops | Bash Calls | Task |
|---------|-------|-----|------------|------|
| s_1776117159825_421 | coach | 98 | 95 (97%) | EXP-154 gym scenario design |
| s_1776117187894_422 | bob | 84 | 80 (95%) | Bayesian Hypothesis Scorecard Pass 4 |

---

## Pattern Classification

### Coach 98-op (s_1776117159825_421) — EXP-154 Design

| Category | Count | % | New? |
|----------|-------|---|------|
| DB queries (gym run results) | 19 | 20% | No — known DB query chain pattern |
| Scenario file exploration (cat/ls) | 17 | 18% | No — known "Gym Scenario Exploration Cascade" (Apr 13 PM) |
| Lab fork setup (mkdir, cp, ls) | 10 | 11% | No — known "Lab Fork Setup Chain" (Apr 13 PM) |
| Grep/find (code search) | 8 | 8% | No — known GREP pattern |
| Gym run/batch execution | 5 | 5% | No — execution, not automatable |
| Transcript parsing (python3) | 3 | 3% | **Partially new** — see below |
| Runner internals (head/sed gym-runner.ts) | 6 | 6% | No — one-off investigation |
| Git history | 2 | 2% | No — known GIT pattern |
| Other (read scenario env files, stat) | 25 | 26% | No — misc exploration |

**Assessment**: Coach's patterns are entirely covered by existing findings. The gym scenario exploration (17 ops) and lab fork setup (10 ops) match the Apr 13 PM finding exactly. The 19 DB queries for gym results are a known pattern — though the specific sub-pattern of querying gym_runs table escalatingly (by scenario, by lab, by tag, by id) could benefit from a `gym-results.sh --scenario X --lab Y` tool.

### Bob 84-op (s_1776117187894_422) — Bayesian Scorecard

| Category | Count | % | New? |
|----------|-------|---|------|
| cat knowledge entries (KE-xxx) | 19 | 24% | **🆕 NEW pattern** — see below |
| cat hypothesis files (H-xxx) | 22 | 28% | **🆕 NEW pattern** — see below |
| cat experiment results (EXP-xxx) | 14 | 18% | **🆕 NEW pattern** — see below |
| cat/grep/tail PRIORITY-TRACKER | 6 | 8% | Part of new pattern |
| cat/grep/tail SCORECARD | 6 | 8% | Part of new pattern |
| ls/find discovery | 8 | 10% | No — known FS discovery |
| for-loop enumerations | 2 | 3% | No — known enumeration |
| Verification (wc, grep, sed on output) | 3 | 4% | No — output checking |

**CRITICAL FINDING**: **27 of 80 bash calls (34%) are re-reads of files already read earlier in the same session.** Specific duplicates:

| File | Times Read | Ops Wasted |
|------|-----------|------------|
| SCORECARD-bayesian-2026-04-11.md | 5 | 4 |
| H-108 hypothesis | 4 | 3 |
| H-103 hypothesis | 3 | 2 |
| H-104 hypothesis | 3 | 2 |
| H-105 hypothesis | 3 | 2 |
| H-106 hypothesis | 2 | 1 |
| H-107 hypothesis | 2 | 1 |
| PRIORITY-TRACKER.md | 3 | 2 |
| KE-170 | 3 | 2 |
| KE-175 | 2 | 1 |
| EXP-152 phase2-results | 2 | 1 |
| EXP-140 results | 2 | 1 |
| EXP-153 results | 2 | 1 |
| **Total duplicate reads** | | **~23 ops** |

---

## New Finding: Knowledge-Base Synthesis Cascade (Bob)

### What's happening

Bob's scorecard task requires synthesizing information across ~20 knowledge entries, ~8 hypotheses, ~6 experiment results, and 2 index files (SCORECARD, PRIORITY-TRACKER). The session follows this pattern:

1. **Discovery phase** (ops 1-12): `ls` and `for`-loop to enumerate what exists
2. **First read** (ops 13-45): Read each KE, hypothesis, and experiment result individually
3. **Context eviction** (implicit): By op 45, the earliest files have fallen out of the context window
4. **Re-read phase** (ops 46-75): Re-read the same files because earlier content was evicted by subsequent reads
5. **Write phase** (ops 76-80): Finally write the scorecard, then verify

This is **not a tool gap** in the traditional sense — no script can prevent context window eviction. But it IS an **op efficiency pattern** that suggests:

**Potential fix**: A `knowledge-bundle.sh --hypotheses H-103,H-104,...,H-108 --entries KE-162..KE-175 --experiments EXP-151,EXP-152,EXP-153` tool that concatenates all requested files into a single output with clear delimiters. Instead of 55 individual `cat` calls, bob would make 1-3 bundle calls, keeping all content in a smaller context window footprint.

**Estimated savings**: 23 ops from eliminated re-reads + ~20 ops from batched initial reads = **~43 ops per synthesis session** (bob does 1-2 per 6h window).

### Why this wasn't seen before

Previous tool gap analyses focused on coach and tech-lead sessions. Bob's high-op sessions were studied for *technique* (research threads, archaeology) but not *bash patterns*. The Apr 11 bash-command-patterns analysis was limited to tech-lead and coach. The Apr 13 PM analysis included bob's 81-op session but focused on the lab-fork pattern (that session was EXP-152, which also had lab forks). This is the first time a pure knowledge-synthesis bob session was analyzed for bash patterns.

---

## Partially New: Gym Transcript Parsing (Coach)

Coach session ops 43-45 attempt to parse gym run transcripts using `python3 -c "import json..."` piped from `cat transcript.jsonl`. This is a 3-op pattern for understanding what an agent did during a gym run.

This wasn't in previous findings but is likely low-volume (only appears in experiment design sessions that need to understand why a run failed). Not worth tooling unless it recurs frequently. Could be addressed by the existing `session-query.ts` if it were adopted.

---

## Summary vs Known Patterns

| Pattern | Status | Source |
|---------|--------|--------|
| DB query escalation chains | KNOWN | Apr 11 (23% of bash) |
| Gym scenario exploration cascade | KNOWN | Apr 13 PM (Pattern 1) |
| Lab fork setup chains | KNOWN | Apr 13 PM (Pattern 2) |
| Git review branch management | KNOWN | Apr 11 + Apr 13 PM (Pattern 3) |
| GREP/code-search chains | KNOWN | Apr 11 (26.5% of bash) |
| Convention-check drilling | KNOWN | Apr 11 (45% of DB queries) |
| **Knowledge-base synthesis cascade** | **🆕 NEW** | This finding |
| Gym transcript parsing | Partially new | Low volume, not worth tooling |

---

## Recommendation

### P1: Knowledge Bundle Tool

**`knowledge-bundle.sh --hypotheses H-103,H-104 --entries KE-162,KE-163 --experiments EXP-151`**

Concatenates requested knowledge base files with clear section headers. Reduces bob's scorecard sessions from ~80 bash ops to ~37 ops (estimated 54% reduction).

**Implementation**: Simple bash script that takes file-type flags and globs, validates paths exist, and cats them with `======== filename ========` delimiters.

**Why now**: This is the highest per-session savings potential (43 ops) for a single session type. Bob runs scorecard/synthesis sessions regularly.

### P2: Gym Results Query Tool

**`gym-results.sh --scenario read-before-edit --lab coder-exp154-process`**

Pre-formatted DB query returning pass/fail by variant, scenario, tag. Would collapse coach's 19 DB queries into ~3-4 targeted calls.

**Estimated savings**: ~12 ops per experiment design session.
