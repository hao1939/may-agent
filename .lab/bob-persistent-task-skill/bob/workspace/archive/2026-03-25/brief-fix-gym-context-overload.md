# Brief: Fix Gym/Oneshot Runtime Blocker (Context Overload)

## Problem
The `gym-runner` and `oneshot` modes are failing for `bob` and `optimizer`.
- Coach reported "Bob/Optimizer are not in oneshot runtime".
- Bob's verification `test-oneshot.sh` timed out after 120s.
- **Root Cause Identified**: `agents/bob/workspace/activity.jsonl` is 1.7MB. The default agent loader reads the *entire workspace* into context. This huge JSONL file is choking the context window or processing time, causing hangs/timeouts.

## Solution
We need a **Context Guard** in the agent loader to ignore large data files in the workspace.

## Implementation Steps
1. **Modify `src/app/agent-loader.ts` (or equivalent workspace loader)**:
   - Add a file size limit (e.g., 50KB) for workspace files.
   - Or explicitly ignore `*.jsonl`, `*.log` files in the workspace read loop.
   - Print a warning: "Skipping large workspace file: X (1.7MB)".
2. **Verify**:
   - Run `bun src/app/may.ts --oneshot --agent bob --task "echo hello"`.
   - It should complete instantly (<5s), not hang.

## Acceptance Criteria
- `bob` runs in oneshot mode without timeout.
- `optimizer` runs in oneshot mode without timeout.
- Large data files in workspace do not crash the agent boot.
