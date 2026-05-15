# Finding: Bob 85-op Deep Research — Technique Comparison vs Efficient Sessions

**Date**: 2026-04-11  
**Session Investigated**: s_1775899748649_1337 (85 ops, 46 turns, 9m26s)  
**Comparison Set**: 36 Bob sessions from April 11 (ops range: 2–85)  
**Status**: TECHNIQUE ANALYSIS — high-value finding

## Executive Summary

Bob's 85-op "Deep Research: Agent Information Flow & Excellence" session is a **fundamentally different session type** from his normal work. It has an ops-per-turn ratio of **1.83** (nearly 2 tool calls per model turn), while all other Bob session categories stay below 1.0. This isn't "bloat" in the usual sense — it's the natural cost of **multi-file source code tracing and original analysis synthesis**, a task type that doesn't map to the D-o-R workflow structure. The session produced 296 lines of substantive, data-backed research — arguably the highest-quality deliverable Bob produced all day.

## The Data

### Session Category Analysis (Bob, April 11, n=36)

| Category | n | Avg Ops | Avg Turns | Ops/Turn | Avg Duration |
|---|---|---|---|---|---|
| Heartbeat (lean, ≤10 ops) | 7 | 6.6 | 12.9 | **0.51** | 474s |
| Heartbeat (medium, 11-30 ops) | 6 | 20.0 | 26.8 | **0.75** | 478s |
| D-o-R Phase 1 (budget-capped) | 9 | 5.9 | 8.8 | **0.67** | 71s |
| D-o-R Phase 2 (writes) | 10 | 33.4 | 36.9 | **0.91** | 332s |
| Work sessions (non-workflow) | 2 | 51.0 | 71.0 | **0.72** | 591s |
| **Deep Research** | **2** | **69.5** | **38.0** | **1.83** | **497s** |

**Key metric**: ops/turn. Below 1.0 means the session often has "thinking-only" turns (no tool call). At 1.83, deep research uses ~2 tool calls every single turn — it's **always reading or querying**.

### Sibling Sessions

| Session | Ops | Turns | Duration | Output |
|---|---|---|---|---|
| s_1775899748649_1337 | 85 | 46 | 9m26s | 296-line research (RESEARCH-agent-information-flow-and-excellence.md) |
| s_1775899811651_1338 | 54 | 30 | 7m8s | 384-line research (deep-research-cognition-collaboration-excellence.md) |
| **Combined** | **139** | **76** | **16m34s** | **680 lines of original analysis** |

Both were dispatched by **May** (not from Bob's heartbeat) via `agents.fork` at ~09:29 UTC with no parent session.

## What Makes Deep Research Different

### Pattern 1: Multi-File Source Code Tracing (unique to deep research)

The task explicitly asked Bob to trace code paths across `src/lib/manager.ts`, `src/app/agent-loader.ts`, `src/lib/active-recall.ts`, and `src/lib/evaluator.ts`. Each code trace requires:
1. `read()` the file to find the function
2. `bash(grep ...)` to locate call sites
3. `read()` related files to follow the chain

This is inherently **2-3 ops per fact discovered**, with no shortcut. The output shows Bob measured exact byte sizes (e.g., "SOUL.md: 6,079 bytes", "Skills: 23,196 bytes across 7 files") — this requires actually reading each file.

### Pattern 2: Database Analysis (unique to deep research)

The task asked Bob to "analyze the evaluations table in the DB — what separates good from needs_improvement?" This produced multi-op query chains:
1. Query schema → 2. Query aggregates → 3. Query specific examples → 4. Cross-reference with session data

Normal sessions never query the database. D-o-R Phase 1 reads existing files; Phase 2 writes structured edits.

### Pattern 3: 4-Question Scope (task design, not Bob's choice)

The task had 4 substantial questions (Q1: information flow tracing, Q2: cross-agent knowledge, Q3: GAN/adversarial patterns, Q4: excellence definition). Each question is a standalone research task. May dispatched this as a single session rather than 4 separate ones.

**Counterfactual**: If dispatched as 4 × ~20-op sessions, total ops would be similar (~80) but with lower risk of timeout and better parallelism.

## What Keeps Normal Sessions Lean

### Lean Heartbeats (4-7 ops): Observe → Decide → Dispatch

The 4-op heartbeat (13:23, s_1775913821270_1435) pattern:
- **Turn 1-2**: Read workspace state (ls/git log), check for new drops
- **Turn 3**: Decide "nothing to do" or "fork work session X"
- **Turn 4**: Finish

These are lean because the **decision tree is shallow** — check 2-3 signals, branch to action or exit. No analysis needed.

### D-o-R Phase 1 (3-7 ops): Budget cap forces plan-first

Phase 1 sessions have `BUDGET: 15 TOOL CALLS MAX` in their prompt. The typical 4-op Phase 1:
- **Turn 1**: Read the task context (injected in prompt, no tool call needed)
- **Turn 2-3**: Read 1-2 key files for planning
- **Turn 4**: Call finish() with the plan

The budget cap is doing its job: it forces Bob to **plan from context** rather than explore the codebase.

### D-o-R Phase 2 (17-60 ops): Structured write sequences

Phase 2 sessions have the plan from Phase 1 and execute it:
- Read target file → Edit → Verify edit → Read next file → Edit → Verify → Commit → Push → Finish

The ops/turn ratio of 0.91 means almost every turn has exactly one tool call. The pattern is **sequential and predictable** — read, edit, verify, repeat.

## Bloat Factors in Deep Research

### Factor 1: Exploratory reads without clear stopping criteria

In the 67-op EXP-134 design session (same time window), Bob spent 97 turns for 67 ops — an ops/turn of 0.69. This means 30% of turns were "thinking without acting." In contrast, the deep research's 1.83 ops/turn means Bob was **reading aggressively** — but the question is whether each read was necessary.

The deep research task provided **no clear completion criteria** — "For each question, read actual session data, trace real code paths" is an open-ended instruction. Compare to D-o-R Phase 2: "Write Deliverables NOW" with a specific plan from Phase 1.

### Factor 2: No budget cap for forked work sessions

The D-o-R workflow's Phase 1 has a 15-op budget cap. The deep research was dispatched as a raw fork — no workflow wrapper, no budget cap. There's nothing structurally limiting it from using 85+ ops.

### Factor 3: Synthesis requires full-context understanding

The deep research output includes cross-references across 133 experiments, evaluations data, code architecture, and theoretical frameworks. This level of synthesis genuinely requires reading many files. The output is **not bloated** — it's dense, data-backed, and novel.

## Efficiency Assessment

| Metric | Deep Research (85 ops) | D-o-R Phase 2 avg (33 ops) | Heartbeat avg (6.6 ops) |
|---|---|---|---|
| Output quality | Original 296-line research with data | Structured KB edits (50-100 lines) | Observe/dispatch only |
| Ops per output line | 0.29 lines/op | ~2-3 lines/op | N/A |
| Value-per-op | **High** (novel analysis) | **Medium** (structured maintenance) | **Variable** (often zero) |
| Could be reduced? | Marginally (maybe 60-70 ops) | Already optimized by D-o-R | Some (from 6.6 to ~4-5) |

The 85-op session is **not a pathological case**. It's expensive but productive. The 680 total lines of cross-referenced original research across both sibling sessions represent some of Bob's most valuable thinking all day.

## Comparison: What Actually Wastes Ops

For reference, here are Bob's actual waste sources today:

| Source | Daily ops | Nature | Fixable? |
|---|---|---|---|
| Heartbeat observation overhead (6.6 avg × 12+ heartbeats) | ~80 | Repetitive ls/git/read | Yes — combine into 1 bash call |
| 30-op "bloated" heartbeats | ~30-60 | Inline work instead of dispatch | Yes — enforce dispatch-only rule |
| D-o-R Phase 2 verification spirals | ~20-40 | Re-reading after edits | Partially — trust edit() more |
| Deep research | 139 (one-time) | Original analysis | No — this is the cost of synthesis |

The deep research sessions account for only **139 ops out of ~800+ total Bob ops today** (17%). The bigger efficiency target is heartbeat overhead (repeated observation costs across 12+ heartbeats).

## Recommendations

### 1. Don't cap deep research sessions (priority: low)

The 85-op session produced high-quality novel analysis. Capping it at 30 ops would have produced Q1 only, losing Q2-Q4. The value/op is actually **better** than many smaller sessions.

### 2. Split multi-question research into parallel forks (priority: medium)

Instead of one 4-question session, May should dispatch 4 separate sessions:
- `## Deep Research: Agent Information Flow (Q1 only)` → ~20 ops
- `## Deep Research: Cross-Agent Knowledge (Q2 only)` → ~20 ops
- etc.

Benefits: parallelism, individual timeout safety, clearer stopping criteria per session.

### 3. Focus optimization effort on heartbeat overhead (priority: high)

Bob's 12+ heartbeats/day at 6.6 avg ops = ~80 ops/day on observation alone. The 4-op heartbeats prove this can be done in 4 ops. Reducing the average from 6.6 to 4.5 saves ~25 ops/day — more than enough to "pay for" one deep research session every 5 days.

### 4. Add research task template with explicit scope and budget (priority: medium)

For forked research sessions, add a template:
```
## Research: [Topic]
BUDGET: 50 tool calls
SCOPE: Answer [specific question] with data
STOPPING CRITERIA: When you have [metric] with [N] supporting examples
DELIVERABLE: [filename.md]
```

This gives the LLM a concrete stopping point without killing the exploratory nature.

---

## Pattern Catalog: What Determines Session Cost

| Pattern | Ops/Turn | Typical Ops | Description |
|---|---|---|---|
| **Observe-Dispatch** | 0.51 | 4-7 | Heartbeat checks state, forks if needed |
| **Plan-from-Context** | 0.67 | 3-7 | D-o-R P1 reads task, outputs plan (budget-capped) |
| **Sequential-Edit** | 0.91 | 17-60 | D-o-R P2 reads→edits→verifies in sequence |
| **Exploratory-Trace** | 1.83 | 54-85 | Multi-file source code tracing + DB queries |

The key insight: **session cost is determined by the task's information density requirement**, not by Bob's behavior. Deep research tasks inherently need to read many files to produce synthesis. The D-o-R workflow keeps structured tasks lean by separating planning (cheap) from execution (expensive but bounded).

[SIG: 1775916078:bob-deep-research-technique]
