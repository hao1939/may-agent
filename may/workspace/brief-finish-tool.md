# Design Brief: Common Sense Infrastructure — The `finish()` Tool

## Context
Common Sense item **1.4 Signal completion clearly** states: "When done, report: what you did, what you produced, and whether it's done/blocked/partial."

Currently, agents end sessions with free-text summaries. This causes:
1.  **Ambiguity**: Supervisors can't programmatically know if a task succeeded or failed.
2.  **Loss of Context**: Deliverable paths are buried in text, making them hard for other agents to find.
3.  **No Structural Block**: Agents can "trail off" without explicitly declaring their state.

## Mechanism: The `finish` Tool
We will implement a system-level tool `finish()` that standardizes session termination.

### Schema
```typescript
type FinishArgs = {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string; // 1-2 sentence high-level outcome
  deliverables?: {
    path: string;
    description: string;
  }[]; // Artifacts produced
  blockers?: {
    reason: string;
    context: string;
  }[]; // Required if status is blocked/failure
  next_steps?: string; // If partial or blocked
};
```

### Behavior
1.  **Termination**: Calling `finish()` immediately ends the session (like `process.exit()`).
2.  **Output**: The tool output becomes the *final* message of the session visible to the parent/manager.
3.  **Structured Log**: The system logs the structured result to `.state/session-outcomes.jsonl` (new file) for Evaluator/Drift analysis.

## Principle Alignment
-   **P1 Simplest Thing That Works**: Replaces parsing chat logs with a structured signal.
-   **P5 Data Integrity**: Enforces that "Done" means "I have a status and a deliverable."
-   **Common Sense 1.4**: Directly implements the "Signal completion clearly" requirement.

## Implementation Plan
1.  **Tech-Lead**: Implement `src/lib/tools/lifecycle.ts` with the `finish` tool.
2.  **Tech-Lead**: Expose it in `agent-loader.ts` (globally available like `read`).
3.  **Coach**: Update `agents/shared/common-sense.md` to mark 1.4 as **Infra Owned**.
