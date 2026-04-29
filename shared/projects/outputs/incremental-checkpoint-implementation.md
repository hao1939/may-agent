# Incremental Checkpoint Implementation

## Summary
Implemented Priority 1 from the v2 roadmap: mid-iteration crash recovery via incremental checkpointing.

## Files Created
1. **`/app/agents/shared/workflows/incremental-checkpoint.ts`** — Core module with:
   - `saveIncrementalCheckpoint()` — persists state after each tool call
   - `detectIncompleteCheckpoint()` — finds crashed sessions on resume
   - `markCheckpointComplete()` — marks iteration as done
   - `cleanupCheckpoints()` — removes old completed checkpoints

2. **`/app/agents/shared/tests/incremental-checkpoint.test.ts`** — 11 tests covering:
   - Save/load/overwrite checkpoint data
   - Detect incomplete vs completed checkpoints
   - Session-specific lookup
   - Cleanup with keepCount retention
   - Edge cases (missing dirs, nonexistent sessions)

## Test Results
All 11 tests pass (vitest 4.1.5, 36ms execution).

## Integration Point
To integrate with `master-worker.ts`, add after each `worker.prompt()` call:
```ts
import { saveIncrementalCheckpoint, markCheckpointComplete, detectIncompleteCheckpoint } from "./incremental-checkpoint.ts";

// At iteration start:
const incomplete = detectIncompleteCheckpoint(projectDir);
if (incomplete) { /* resume from incomplete.step */ }

// After worker.prompt():
saveIncrementalCheckpoint(projectDir, { sessionId, iteration, step, timestamp: Date.now(), task, toolsCalled, partialResults, completed: false });

// After successful iteration:
markCheckpointComplete(projectDir, sessionId);
```
