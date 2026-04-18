# Design Brief: Structured Checkpoints (Common Sense P3.5)

**Status**: Proposal
**Owner**: Bob
**Target**: Tech-Lead

## Problem
Agents currently rely on implicit memory (re-reading transcripts) or ad-hoc notes to persist state between sessions. This leads to:
1. **Context Loss**: "What was I doing?"
2. **Repetition**: Re-discovering the same facts.
3. **Drift**: Losing track of the original goal.

**Common Sense P3.5** states: "Your state is the filesystem. You have no memory between sessions." We need to make this easy.

## Solution: `checkpoint()` Tool
A dedicated tool for explicitly saving session state. This implements the "CommitOutcome" pattern from StatePlane (arXiv:2603.13644).

### Signature
```typescript
checkpoint(data: {
  status: "in_progress" | "blocked" | "completed",
  summary: string, // 1-2 sentences on what was achieved this session
  next_steps: string[], // What needs to happen next
  artifacts: { path: string, description: string }[], // Paths to created/modified files
  context: Record<string, any> // Flexible key-value store for specific state
})
```

### Behavior
- **Persist**: Writes to `.state/sessions/{sessionId}.json` (or similar).
- **Inject**: Upon resuming a session (or starting a new session in the same thread), the `checkpoint` data is injected into the system prompt or initial context.
- **Replace**: Each checkpoint *replaces* the previous one for that session thread. It is the *current* state.

### Why
- **Simplicity**: One tool call to "save game".
- **Structure**: Enforces thinking about "what's next" and "what did I make".
- **Recovery**: If a session crashes, the next agent picks up exactly where the last one left off.

## Implementation Plan
1. **Define Tool**: Add `checkpoint` to `src/lib/tools/definitions.ts`.
2. **Implement Handler**: Create `src/lib/tools/checkpoint.ts` to write to disk.
3. **Inject Context**: Update `src/app/agent-loader.ts` to read the latest checkpoint for the thread and include it in the `system_instructions` or `user_message`.
4. **Docs**: Update `agents/shared/common-sense.md` to reflect `checkpoint()` availability.

## Success Criteria
- Agents use `checkpoint()` at the end of multi-turn sessions.
- Resumed sessions reference the checkpoint data ("I see I left off at step 3...").
- Reduction in "I will read the last 50 messages to understand context" operations.
