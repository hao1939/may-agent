# Agent Learning from Experience — Design Doc

## Problem Statement

Our agents currently have no mechanism to learn from experience across sessions. Each session starts fresh with only the task description as context. Agents repeat mistakes, rediscover workarounds, and fail to build on prior successes.

The core question: **What's the right format, timing, and delivery mechanism for learned lessons?**

Key constraints from human guidance:
- Text works for changing behavior — don't over-index on structural enforcement
- Experiment first, prove it works, then adopt
- Don't brute-force inject context — design for *learning*, not information dumping

## Current State: Analysis of `buildSessionContext()` in `src/lib/manager.ts`

> **Source:** Extracted from the compiled binary at `/app/agents/may-agent-bin`. The function is a method on the session manager class.

**Correction:** `buildSessionContext()` is **NOT dead code** — it IS called during session launch. The launch path does: `const sessionContext = this.buildSessionContext(...)` then sends `${sessionContext}\n\n---\n\n${task}` as the prompt. So agents already receive this context. The human's comment about "throws it all away" may refer to an older version or a different issue.

### What `buildSessionContext()` Actually Computes

The function builds a `# Session Context` block prepended to every agent's task prompt:

| Data Source | How It Works | Current Status |
|---|---|---|
| **Session metadata** | Session ID + current timestamp | ✅ Always included |
| **Recent Task History** | Reads memory entries (via `readMemoryEntries`) up to `memoryLimit` (default 20). Each entry has: timestamp, task text (truncated), status, duration, summary, completed items, new items, files modified | ✅ Active — agents see their last N task summaries |
| **Active Recall** | `runActiveRecall(agentName, projectRoot)` — retrieves warnings/alerts relevant to the agent. Formatted via `formatRecallWarnings()` | ✅ Active — retrieves agent-specific warnings |
| **Last Checkpoint** | `readLatestCheckpointForAgent()` — gets most recent checkpoint with summary, data, age, and originating session | ✅ Active — enables within-task continuity |
| **Context Files** | Reads `def.contextFiles` paths (e.g., `agents/<name>/context.md`) and appends their content | ✅ Active — this is the `context_updates` mechanism from `finish()` |

### What `appendMemory()` Persists After Each Session

After a session ends, `appendMemory()` extracts from the `finish()` call:
- Task, status, duration, summary
- `completed_items`, `new_items`, `filesModified`
- Stored via `appendMemoryEntry()` keyed by agent name

### Key Insight: The Infrastructure Is Already Wired

The learning pipeline exists: agents report lessons via `finish()` → lessons persist to memory → `buildSessionContext()` retrieves them → next session receives them. **The problem isn't missing plumbing — it's the quality of what flows through it.**

Current gaps:
1. **No distillation** — memory entries are raw task summaries, not extracted lessons. An agent that ran 20 sessions gets 20 one-line summaries, not "here's what I learned"
2. **No relevance filtering** — all recent entries are included regardless of relevance to the current task
3. **`finish()` lessons field** (`lessons` in the schema) — it's unclear if these are actually surfaced back. The `appendMemory` function doesn't extract them
4. **No cross-agent learning** — agent A's discoveries don't benefit agent B
5. **Context budget** — 20 memory entries × ~1 line each is small, but as learning grows this needs management

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
