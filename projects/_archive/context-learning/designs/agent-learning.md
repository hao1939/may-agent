# Agent Learning from Experience — Design Doc

## Problem Statement

Our agents currently have no mechanism to learn from experience across sessions. Each session starts fresh with only the task description as context. Agents repeat mistakes, rediscover workarounds, and fail to build on prior successes.

The core question: **What's the right format, timing, and delivery mechanism for learned lessons?**

Key constraints from human guidance:
- Text works for changing behavior — don't over-index on structural enforcement
- Experiment first, prove it works, then adopt
- Don't brute-force inject context — design for *learning*, not information dumping

## Current State: Dead Code in `buildSessionContext()`

> **Note:** The `buildSessionContext()` function lives in the main infrastructure repo at `src/lib/manager.ts`, which is not accessible from this workspace. The analysis below is based on the human's description (iteration 14 comments).

The infrastructure already has a ~144-line function `buildSessionContext()` in `src/lib/manager.ts` that computes rich session context but **throws it all away** — the user message sent to agents contains only the task text. This is dead code that was presumably intended to give agents continuity.

### Data Sources Computed (but discarded)

| Data Source | Description | Learning Value |
|---|---|---|
| **Digests** | Compressed summaries of prior sessions | High — captures what happened without full transcripts |
| **Cross-agent context** | What other agents are doing/have done | Medium — useful for coordination, less for individual learning |
| **Active recall** | Retrieved memories relevant to current task | High — this IS the learning retrieval mechanism |
| **Session diffs** | What changed between sessions | Medium — useful for understanding trajectory |
| **Checkpoints** | Structured progress snapshots saved mid-session | High — captures intermediate state and decisions |
| **Last-session summaries** | What the previous session accomplished | High — direct continuity signal |

### Why It's Dead Code

The function computes all this context but the session launch path only passes the task text as the user message. The computed context is never injected into the prompt. This needs cleanup (requires Hao as it's a `src/` change).

### What This Tells Us

The infrastructure *already knows* what data is available for learning. The question isn't "what inputs exist" but rather:
1. Which of these inputs actually improve agent performance?
2. What's the right way to distill them (raw injection vs. learned lessons)?
3. How do we avoid context bloat while preserving useful experience?

## Existing Learning Mechanisms

### Current: `finish()` Lessons Field
Agents can report lessons via the `finish()` tool with structured categories (`fix`, `pattern`, `insight`). These are persisted to memory but it's unclear how effectively they're retrieved and applied.

### Current: `context.md` Files
The `finish()` tool has a `context_updates` field that persists facts to `agents/<name>/context.md`. This is loaded into future sessions. This is the closest thing to durable learning we have.

### Current: Checkpoints
The `checkpoint()` tool saves structured progress mid-session. Available to next session via `readCheckpoints`. Good for within-task continuity, less for cross-task learning.

## Research: External Approaches

> **Status:** Scout research dispatched. Investigating OpenClaw, Hermes Agent, and other frameworks (MemGPT, Voyager, Reflexion). Results will be added here when available.

*Placeholder — see `docs/research/agent-learning-mechanisms.md` when scout completes.*

## Proposed Design

> To be filled in after research results are available and the dead code has been analyzed directly.

### Design Principles (from human guidance)
1. **Text-based** — lessons are natural language, not structural constraints
2. **Experiment-driven** — prove mechanisms work before adopting
3. **Learning, not injection** — agents should develop understanding, not receive data dumps

### Open Questions for Design
- Should lessons be per-agent or shared across agent types?
- What triggers lesson extraction — every session, only failures, only successes?
- How do we measure if learning is working? (Need a before/after evaluation)
- Should lessons have expiry/decay? (Stale lessons may hurt)
- How do we handle contradictory lessons?

## Open Questions

1. **Access to dead code**: Need to directly read `buildSessionContext()` to do a proper analysis. Can we get access to the infra repo, or should Hao provide the relevant code?

2. **Evaluation methodology**: How do we prove a learning mechanism works? The gym was planned for this but the prettier scenario is broken. Need an alternative evaluation approach.

3. **Scope of "experience"**: Are we focused on:
   - Within-task learning (session N informs session N+1 of same task)?
   - Cross-task learning (lessons from task A help with task B)?
   - Cross-agent learning (worker learns from reviewer's feedback)?

4. **Context budget**: How much of the context window should be allocated to experience/lessons vs. the actual task?

5. **Human-in-the-loop**: Should humans curate/approve learned lessons, or should the system be fully autonomous?
