# Scout Delegation Investigation

**Date**: 2026-04-14  
**Investigator**: Coach  
**Subject**: Why Scout has ZERO child sessions across 1,146 sessions

## Executive Summary

Scout has **1 child session across 1,146 total sessions** — and that single child was spawned in the session running right now (s_1776147698528_19). For comparison: Bob has 595, Coach 371, Optimizer 226, Tech-lead 191. Scout is a total outlier.

The issue is **behavioral, not config** — Scout's archetype correctly lists `agents` and `workflow` tools. The root cause is a combination of: (1) Scout's heartbeat only teaching self-fork patterns, (2) a learned helplessness from early fork failures, and (3) zero cross-agent delegation patterns in Scout's instructions.

## Evidence

### Quantitative

| Agent | Total Sessions | Child Sessions Spawned |
|-------|---------------|----------------------|
| Bob | - | 595 |
| Coach | - | 371 |
| Optimizer | - | 226 |
| Tech-lead | - | 191 |
| **Scout** | **1,146** | **1** |

Scout's op distribution in heartbeats:
- **711** sessions with ≤10 ops (lean heartbeats — good)
- **171** sessions with 11-20 ops
- **97** sessions with 21-30 ops (doing research inline)
- **75** sessions with 31+ ops (massive inline research — the problem)

Multiple sessions hit 50-78 ops in heartbeats — exactly the "research snowball" the heartbeat warns about.

### The "Fork Broken" Belief

Around session ~393 (April 8), Scout wrote in todo.md:

> **Fork mechanism**: Confirmed non-functional. All dispatched sessions produce no output. Must do substantive work inline in heartbeats.

By session 719 (April 13):

> **Fork capability still NON-FUNCTIONAL at runtime**: agents+workflow tools listed in archetype but NOT provided in actual tool set. Runtime tools: read, bash, edit, write, scrape_webpage, checkpoint, finish. No agents/workflow tools available. Dispatch impossible.

This appears to be an intermittent issue — the tools were sometimes not injected at runtime. Scout correctly observed this in some sessions and generalized it to "forks are always broken." This became a durable belief that persisted even after tools were fixed.

### "Flag for Bob" — Words Without Actions

Scout's todo.md contains **~20+ instances** of "Flag for Bob" or "Flag for Coach" with HIGH or CRITICAL priority. Examples:

- "Flag for Bob (HIGH): CR#325 provides the external validation layer KE-101 currently lacks"
- "Flag for Bob (HIGH): CR#324 provides the missing orchestration layer for KE-104"
- "Flag for Bob (CRITICAL): DD#732 provides formal conformal calibration for KE-117"
- "Flag for Bob/Coach (CRITICAL): CR#326 recommends pausing gym-based FM-3.3 experiments"

**None of these were ever sent.** They're all text notes in todo.md. Scout never calls `agents.message()` to actually dispatch these recommendations.

### Heartbeat Only Teaches Self-Fork

Scout's heartbeat Step 3 (DISPATCH) shows only one fork pattern:

```javascript
// The heartbeat template — ONLY shows scout → scout
workflow.run("verify-wrap", `[WORK SESSION] <specific task description>...`)
```

All examples are scout dispatching work to itself:
- "Daily arXiv triage" → self
- "Weekend synthesis" → self
- "Targeted research" → self
- "Deep dive enrichment" → self
- "Hypothesis writing" → self

**Zero examples of cross-agent delegation.** No mention of `agents.message('bob', ...)` or `agents.fork({agent: 'tech-lead', ...})`.

Compare with Coach's heartbeat, which dispatches to: coach (self), coder, tech-lead, optimizer, scout, bob, evaluator — 7 different agents.

## Root Cause Analysis

### RC-1: No Cross-Agent Delegation Patterns in Heartbeat
Scout's heartbeat is a self-contained research loop. It says "fork substantive work" but only ever shows forking to itself. There's no concept of "found a finding → tell the relevant specialist."

### RC-2: Learned Helplessness from Tool Unavailability
Scout experienced real tool unavailability in some sessions (tools not injected at runtime). It correctly observed this but over-generalized to "forks are always broken." This belief was never corrected because no session successfully forked — creating a self-reinforcing cycle.

### RC-3: Passive Handoff Pattern
Scout developed a workaround: write "Flag for Bob (HIGH)" in todo.md and hope Bob reads it. This passive pattern became Scout's only "delegation" mechanism. Bob does eventually absorb Scout's research — but only because Bob proactively reads the shared library, not because Scout pushes it.

### RC-4: No Propagation Phase That Includes Sending Messages
Scout's phased work structure (Triage → Dive → Synthesize → Propagate) defines Phase 4 "Propagate" as: "Update INDEX.md, papers.md/repos.md, write RECOMMEND lines." It never says "send messages to relevant agents." The RECOMMEND lines go to todo.md — another passive mechanism.

## Impact

1. **Research-to-action pipeline delay**: Scout writes deep dives that take days to reach Bob, instead of hours
2. **Lost signals**: Some "Flag for Bob" items may never be noticed
3. **Wasted ops**: Scout does 50-78 op heartbeats doing research inline instead of forking specialists
4. **No collaborative enrichment**: Scout never asks tech-lead to review implementation feasibility, or asks bob to cross-reference with experimental data

## Intervention Design

### Principle: Delegation Should Enhance, Not Replace

Scout's core value is research discovery and synthesis. The intervention should add a "push" mechanism at natural decision points, not restructure how Scout works.

### Intervention: Add Cross-Agent Dispatch Patterns to Step 3

**Where**: Scout's heartbeat, Step 3 (DISPATCH), added as a subsection within the existing step structure.

**What**: A "Cross-Agent Recommendations" section that teaches Scout to use `agents.message()` at two natural moments:
1. **After writing a Flag for X**: Convert passive todo notes to active messages
2. **After Phase 4 (Propagate)**: Push high-signal findings to the relevant specialist

**Key constraint (KE-008)**: We do NOT restructure steps. We add content within Step 3.

### Why `agents.message()` not `agents.fork()`

- `agents.message()` is fire-and-forget — Scout continues scanning, recipient picks up next heartbeat
- `agents.fork()` blocks or creates process overhead Scout doesn't need
- Messages are the right tool for "I found X, you should look at Y" handoffs
- This matches the "scout finds → specialist acts" workflow

### Also: Remove the "Fork Broken" Belief

Scout's context.md and todo.md contain the stale "fork non-functional" belief. This needs to be corrected now that tools are working (the currently running session proves it).
