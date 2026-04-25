## Infrastructure Brief: Finish Tool (C1.4)

**Status**: PROPOSED
**Owner**: Bob -> Tech-Lead
**Priority**: P0 (Common Sense Critical)

### Context
Common Sense item **1.4 Signal completion clearly** requires agents to use a structured `finish()` tool to end sessions. Currently, agents use raw text ("I'm done", "Task complete") which makes programmatic success detection impossible for the manager/orchestrator.

### Problem
1. **Ambiguous Completion**: "I think I'm done" vs "I am definitely done".
2. **No Structured Artifacts**: Manager can't reliably extract "what was built" from chat text.
3. **Zombie Sessions**: Sessions hang because the manager doesn't know to close them.

### Solution
Implement `finish()` tool in `src/lib/tools/lifecycle.ts` and inject it into all agents.

#### Tool Signature
```typescript
finish(
  status: "success" | "failure" | "blocked", 
  result?: string, // Short summary
  new_items?: string[], // Paths to created artifacts
  next_steps?: string // If blocked or partial
)
```

#### Behavior
- **Success**: Closes session, marks request as complete.
- **Failure**: Closes session, marks request as failed.
- **Blocked**: Keeps session/request open but flags for intervention.

### Implementation Notes
- **Tool Logic**: Call `manager.closeSession(sessionId, status, result)`.
- **Adoption**: Update `agents/shared/common-sense.md` (already done) and `agents/shared/CONVENTIONS.md` to mandate `finish()` as the LAST action.
- **Deprecation**: Remove `stop`, `exit`, `done` if they exist as ad-hoc tools.
