# Design Brief: Common Sense Infra 3.5 - Structured Checkpoints

**Status**: Proposed
**Goal**: Implement "Your state is the filesystem" (Common Sense 3.5) via a dedicated tool.
**Owner**: Tech-Lead

## Problem
Agents currently rely on ad-hoc file writes (`workspace/progress.md`, `todo.md`) to save state between sessions. This is unstructured, error-prone, and often skipped. If an agent crashes or the session ends unexpectedly, complex multi-step state is lost, leading to "amnesia loops" where the agent restarts from zero.

## Solution: `checkpoint()` Tool
A simple, standardized tool for saving execution state to a durable, structured location.

### 1. Tool Signature
```typescript
checkpoint(args: {
  id: string;          // Unique ID for this task/workflow
  step: string;        // Current step name/number
  data: any;           // JSON object with relevant state variables
  status: "in_progress" | "completed" | "failed";
})
```

### 2. Storage
Writes to `.state/checkpoints/<agent_name>/<id>.json`.
This file persists across sessions.

### 3. Usage Pattern
**Start of Session:**
```typescript
// Agent checks if previous state exists
const state = read(".state/checkpoints/bob/task-123.json");
if (state) {
  // Resume from state.step
}
```

**During Execution:**
```typescript
// After completing a heavy step
checkpoint({
  id: "task-123",
  step: "2_analysis_complete",
  data: { findings: [...] },
  status: "in_progress"
})
```

## Implementation Details
1. **Create `src/lib/tools/checkpoint.ts`**:
   - Validate args.
   - Ensure `.state/checkpoints/<agent>` directory exists.
   - Write atomic JSON file.
2. **Expose in `agent-loader.ts`**:
   - Add to default toolset for all agents (or focused set first).
3. **Docs**:
   - Update `agents/shared/common-sense.md` to reflect the new tool.

## Benefits
- **Resilience**: Crashed sessions can be resumed exactly where they left off.
- **Observability**: We can see exactly where agents are stuck by inspecting checkpoint files.
- **Simplicity**: Replaces ad-hoc `write("progress.md")` patterns.
