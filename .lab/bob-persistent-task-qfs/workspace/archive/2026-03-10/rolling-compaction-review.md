# Review: Rolling Compaction Design

## Status: APPROVED with minor risks

I have reviewed the design proposal `agents/may/workspace/rolling-compaction-design.md` and the relevant source code (`src/compaction.ts`, `src/manager.ts`).

## Verdict
**APPROVED: Option C (Manager-Level Compaction After Idle)** is the correct architectural choice.
- **Why**: It aligns with our "Disk is Truth" principle. The full history remains safe on disk (`session.jsonl`), while the in-memory state is aggressively pruned to match the LLM's context window. This solves the unbounded memory growth problem without risking data loss.
- **Why not D (Ephemeral Heartbeats)**: While elegant, it breaks continuity for the interface agent (May). May needs to remember "I asked you to do X five minutes ago." Ephemeral sessions would induce amnesia between every interaction.

## Answers to Key Questions

### 1. Is `handleCompletion` the right place?
**Yes.**
- The manager's `handleCompletion` (or the logic that detects a session has gone idle) is the perfect lifecycle hook.
- **Race Condition Risk**: Low. If a `followUp` arrives while compaction is running, the agent is technically "busy." The manager should ensure compaction is atomic or that the agent state is locked during the `replaceMessages` call.
- **Mitigation**: Ensure `replaceMessages` is synchronous or fast. The compaction *calculation* (`await transformContext`) can take time, but the *application* of the result is instant.

### 2. Is Option D safe for heartbeats?
**Yes, but only for pure background workers.**
- A "Check HN" agent doesn't need to remember yesterday's check. It just needs the current state of `todo.md`.
- **Recommendation**: Implement Option C first (universal fix). Option D is an optimization we can defer.

### 3. The "Closure State Bug" (accumulatedSummary bloating)
**Confirmed.**
- `createCompactionTransform` maintains `accumulatedSummary` in its closure.
- **Problem**: When `transformContext` runs multiple times within one session *without* replacing the underlying messages, it re-summarizes the same old messages repeatedly, appending to `accumulatedSummary`.
- **Fix**: The design correctly identifies that `replaceMessages` solves this. By replacing the underlying array with the compacted version, the next `transformContext` call sees a small array and doesn't trigger compaction again until it grows. The closure state naturally resets because the input data changes.

### 4. Resume after restart
- **Current**: Loads full `session.jsonl`.
- **Proposed**: Load full `session.jsonl` -> immediate compaction.
- **Verdict**: Acceptable for now. Optimizing this (saving `session-compact.jsonl`) is a premature optimization. Let's fix the memory leak first.

## Implementation Plan

1. **Step 1: Expose `replaceMessages` on Agent**
   - Ensure the `pi-agent-core` Agent class allows replacing the message history. (It does: `agent.replaceMessages(newMessages)`).

2. **Step 2: Update Manager to compact on idle**
   - In `src/manager.ts`, locate where persistent sessions go idle.
   - Add `compactPersistentSession(session)`:
     - Check if `session.persistent` and `session.compactionTransform` exist.
     - `const compacted = await session.compactionTransform(session.agent.state.messages);`
     - `session.agent.replaceMessages(compacted);`
   - **CRITICAL**: Do NOT write to `session.jsonl` during this step. The disk must keep the full history.

3. **Step 3: Verify**
   - Run a long session.
   - Check `_state.messages.length` stays bounded.
   - Check `session.jsonl` keeps growing (full history).

## Risk Assessment
- **Risk**: `replaceMessages` might confuse the `appendSessionMessage` logic if not careful.
  - *Mitigation*: `appendSessionMessage` listens to `message_end` events. It appends *new* messages as they arrive. It doesn't care about the history array. Compacting history doesn't trigger `message_end` events, so `session.jsonl` remains append-only and safe.
- **Risk**: Losing the "Original Task" or "Key Facts".
  - *Mitigation*: `src/compaction.ts` already handles this via `extractOriginalTask` and `extractKeyFacts`. These are preserved in the summary header.

## Recommendation
**Proceed with Option C immediately.** It fixes a memory leak that threatens long-running agent reliability.
