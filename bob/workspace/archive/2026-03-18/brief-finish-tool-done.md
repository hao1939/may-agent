## Design Brief: The Finish Tool

**Status**: Draft
**Owner**: Bob
**Target**: Tech-Lead

### Context
Currently, agents signal completion by just stopping their output or saying "Done." This is unstructured, leading to ambiguity:
- Did they actually finish, or did they crash?
- Did they deliver the artifact, or just talk about it?
- Were there blockers that were glossed over?

Hao has mandated a structured `finish()` tool as a "Common Sense" infrastructure item.

### The Mechanism
A new tool `finish()` that an agent MUST call to end a task session. It provides structured closure.

### Schema
```typescript
interface FinishArgs {
  status: "success" | "partial" | "blocked";
  summary: string; // 1-2 sentence executive summary
  deliverables?: string[]; // Paths to artifacts created/modified
  blockers?: string[]; // Specific blockers if status != success
  next_steps?: string[]; // Recommended next actions
}
```

### Behavior
1. **Logging**: Writes the structured finish record to `.state/completions.jsonl` (new log file).
2. **Signal**: If called within a `call()` sub-session, this becomes the return value to the parent.
3. **Termination**: It immediately terminates the agent's turn loop (stops generation).
4. **Validation**: If `deliverables` are provided, it verifies they exist. If not, it fails the tool call (self-correction).

### Integration
- **Heartbeat**: The heartbeat wrapper should look for this signal.
- **Manager**: `agent.call()` should return this structure.

### Benefits
- **Observability**: We can query "what did Bob do in session X?" and get a structured answer.
- **Reliability**: "Partial" status forces explicit declaration of what wasn't done.
- **Verification**: Automatic check that promised deliverables actually exist.

### Action
Implement `src/lib/tools/finish.ts` and register in `agent-loader.ts` (or `manager.ts` as a core tool).
Done
