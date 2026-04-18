# Design Brief: `finish()` Tool Implementation

## Context
**Origin**: `agents/shared/common-sense.md` (Item 1.4: Signal completion clearly).
**Problem**: Agents currently end sessions with unstructured text ("I'm done", "Task complete", "Here is the file"). This makes it impossible for the system (and parent agents) to programmatically verify if the task succeeded, failed, or was blocked.
**Goal**: Replace text-based completion with a structured `finish()` tool that forces agents to declare their outcome status and deliverables explicitly.

## Philosophy Alignment
- **P40 Promise-Deliver-Report**: This tool enforces the "Report" phase structurally.
- **P23 No Silent Failures**: Forces explicit `status: "blocked" | "failure"` reporting.
- **P82 Structured Signals**: Converts natural language completion into machine-readable data.

## Specification

### Tool Interface
Create `src/lib/tools/finish.ts`.

```typescript
type FinishArgs = {
  /**
   * The outcome of the session/task.
   * - success: All promises delivered.
   * - failure: Critical error prevents completion.
   * - blocked: External dependency missing or blocker encountered.
   * - partial: Some promises delivered, others deferred/failed.
   */
  status: 'success' | 'failure' | 'blocked' | 'partial';

  /**
   * 1-2 sentence executive summary of what was accomplished.
   */
  summary: string;

  /**
   * List of artifacts produced or modified.
   */
  deliverables?: Array<{
    path: string; // Relative to project root
    description: string; // Brief description of what this file is
  }>;

  /**
   * Required if status is 'blocked' or 'failure'.
   */
  blockers?: Array<{
    reason: string; // What is blocking progress
    context: string; // Additional context
  }>;
  
  /**
   * Recommended next actions if partial or blocked.
   */
  next_steps?: string;
};
```

### Behavior
1.  **Terminating**: Calling `finish()` should be the **last** action in a session. The system should treat this as a signal to close the session (or return control to the parent agent).
2.  **Validation**:
    *   If `status` is 'blocked' or 'failure', `blockers` must be non-empty.
    *   If `deliverables` are provided, verify files exist (warn if not, but don't fail).
3.  **Output**: Return a formatted summary string confirming the session is closed and the status recorded.

### Integration
1.  **Register**: Add to `src/lib/tools/index.ts`.
2.  **Expose**: Add to `agent-loader.ts` or relevant config to ensure ALL agents have this tool by default.
3.  **Prompting**: Update `agents/shared/common-sense.md` (already done) and `agents/shared/system.md` (or equivalent) to instruct agents: "ALWAYS end your session with the `finish()` tool. Do not just say you are done."

## Deliverables
1.  `src/lib/tools/finish.ts` (Implementation)
2.  `test/tools/finish.test.ts` (Unit tests)
3.  Integration into the tool registry.

## Success Criteria
- Agents can call `finish({ status: 'success', summary: '...', deliverables: [...] })`.
- The system logs the structured result (e.g., to `memory.jsonl` or session logs).
