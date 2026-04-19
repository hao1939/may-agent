# Design: Rolling Compaction — Full History on Disk, Compacted Window for LLM

## Status: Draft (2025-03-07)

---

## Problem

Persistent sessions (heartbeats, May's chat) accumulate messages indefinitely in `agent._state.messages`. The `transformContext` compaction only affects what the LLM **sees** — it returns a compacted array for the LLM call but does NOT modify the in-memory message array. So `_state.messages` grows without bound across `followUp()` calls.

### How it works today

```
_runLoop() starts:
  context.messages = this._state.messages.slice()  // copy of full history
  
  For each LLM call:
    transformContext(context.messages) → [summary, ...recent]  // for LLM only
    context.messages.push(newMessage)  // full history keeps growing
    
  On message_end events:
    this.appendMessage(msg)  → _state.messages grows
    appendSessionMessage()   → session.jsonl on disk (append-only)

_runLoop() ends:
  _state.messages has ALL messages (including new ones from this run)

Next followUp():
  _runLoop() starts again with _state.messages.slice() — even bigger now
```

### Three-layer truth problem

| Layer | What it holds | Grows? |
|-------|--------------|--------|
| Disk (`session.jsonl`) | Complete history, append-only | ✅ Yes but fine (sequential IO) |
| Memory (`_state.messages`) | Complete history | ❌ Unbounded — grows every followUp() |
| LLM window | Compacted via transformContext | ✅ Bounded by threshold |

The disk already has the full truth. Memory duplicates it needlessly.

### Additional subtle bug

The `transformContext` closure accumulates `accumulatedSummary` across calls. Since `context.messages` is never trimmed, each LLM call within a single run re-summarizes the same old messages and keeps growing `accumulatedSummary`. For long-running sessions with many tool calls, the summary bloats.

---

## Core Insight

**The full history already lives on disk. Keep memory bounded by replacing it with the compacted version after each idle.**

The LLM should see: `[system_prompt, compacted_summary, ...recent_messages]`
The disk should hold: `[every message ever, append-only]`  
Memory should hold: only the compacted version (what the LLM actually needs)

---

## Solution: Manager-Level Compaction After Idle (Option C)

No changes to `pi-agent-core` required. The manager already:
- Knows when sessions go idle (handles completion)
- Has the compaction transform (via `buildTransformContext`)
- Has `agent.replaceMessages()` available

### Implementation

```ts
// In manager, after a persistent session goes idle:

private async compactPersistentSession(session: ActiveSession): Promise<void> {
  if (!session.persistent) return;
  if (!session.compactionTransform) return;
  
  const messages = session.agent.state.messages;
  const compacted = await session.compactionTransform(messages);
  
  if (compacted.length < messages.length) {
    session.agent.replaceMessages(compacted);
    // session.jsonl is untouched — it has the full history on disk
  }
}
```

Call this from `handleCompletion()` for persistent sessions (they don't get archived, they stay idle waiting for the next followUp).

### What changes

| Concern | Before | After |
|---------|--------|-------|
| Disk (session.jsonl) | Full history, append-only | **Same — no change** |
| In-memory (_state.messages) | Grows without bound | **Bounded by compaction after each idle** |
| LLM context window | Compacted by transformContext | **Same** (but faster — less to scan) |
| Resume after restart | Load full JSONL into memory | **Could load compacted instead** (future) |

### Resume strategy

When a persistent session resumes after process restart:
1. Load all messages from `session.jsonl` into `_state.messages` (current behavior)
2. Compaction runs naturally on the first LLM call via `transformContext`
3. After the run completes and session goes idle, `compactPersistentSession` trims memory

**Future optimization**: Save the compacted state separately (e.g., `session-compact.jsonl`) and load that on resume instead of the full JSONL. This avoids loading thousands of messages just to compact them immediately.

---

## Alternative: Ephemeral Heartbeats (Option D)

For heartbeat sessions specifically, consider making each tick a fresh session:
- Each heartbeat tick → `manager.run()` (new session, new agent)
- Agent starts clean, reads SOUL.md/workspace files, does work, session ends
- Zero memory accumulation, no compaction needed

**Pros**: Simplest possible. No memory growth. Each tick is independent.
**Cons**: No conversational continuity — agent can't say "last time I checked X."

But heartbeat agents are designed to read their workspace files anyway. File-based state IS the continuity mechanism. The agent doesn't need to remember what it said 12 hours ago — it reads the current state of todo.md, analyzes it, and acts.

**Recommendation**: Option D for heartbeats (simpler), Option C for May's chat session (needs continuity).

---

## Impact by Session Type

| Session type | Solution | Memory bound |
|-------------|----------|-------------|
| **Heartbeats** (6 agents, 12-48h) | Option D: ephemeral ticks | Zero growth |
| **May's chat** | Option C: compact after idle | Bounded by compaction threshold |
| **Sub-agents** (attached) | Already ephemeral | Already bounded |
| **Sub-agents** (detached, future) | Ephemeral by design | Already bounded |

---

## Interaction with Existing Compaction

The `createCompactionTransform` closure tracks `accumulatedSummary` and `accumulatedKeyFacts` across calls. With Option C:

1. During a run: `transformContext` runs per LLM call, accumulates summary in closure
2. After idle: `compactPersistentSession` calls the same transform one more time, gets the compact result, replaces _state.messages
3. Next followUp: the transform sees a much smaller input (already compacted), may not trigger at all

The closure state persists across calls within a process lifetime. On restart, a new closure starts fresh — but the loaded messages already contain the previous compaction summary message, so context isn't lost.

---

## Next Steps

1. **Immediate**: Implement Option C in manager — `compactPersistentSession` after idle
2. **Soon**: Implement Option D for heartbeats — change `fireHeartbeat` to use `manager.run()` instead of `followUp()` on a persistent session
3. **Later**: Save compact state to disk for faster resume
4. **Later**: Two-tier state in pi-agent-core (clean separation at the library level)
