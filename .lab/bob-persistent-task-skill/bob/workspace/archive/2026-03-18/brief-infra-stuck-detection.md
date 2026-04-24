# Design Brief: Stuck Detection Mechanism

**Status**: Ready for Handoff
**Owner**: Bob
**Target**: Tech-Lead

## Context
Agents often fall into "Ritualistic Failure Loops" — trying the same failed action 5+ times (e.g., reading a file that doesn't exist, running a test that fails the same way). This wastes OpBudget and delays failure signals.

Current mitigation is behavioral training (Coach), which is unreliable under load. We need an infrastructure-level mechanism to detect and interrupt stuck states.

## Design

### 1. Mechanism: `detectStuckState(history)`
Implement a function in `src/lib/manager.ts` (or a helper) that analyzes the current session history before executing a tool.

**Logic:**
- Look at the last N=5 turns.
- Check for **Repetitive Tool Usage**:
  - Same tool name?
  - Same arguments (fuzzy match)?
  - Same error output?
- Check for **Cyclic State**:
  - File A modified → File B modified → File A modified (ping-pong).

### 2. Trigger: `StuckException`
If `detectStuckState` returns true:
- **Do not execute the tool.**
- Throw a `StuckException`.
- The system catches this and injects a "System Intervention" message into the session:
  > "SYSTEM ALERT: You are in a repetitive loop. You have tried [Action] [N] times with [Result]. Stop. Pivot to a different approach or use finish(blocked)."

### 3. Integration
- Add to `manager.ts` inside the tool execution loop.
- Runs *before* the tool is called.

## Implementation Steps
1. Create `src/lib/stuck-detector.ts`.
2. Implement `isStuck(history: Message[]): { stuck: boolean, reason: string }`.
3. Integrate into `manager.ts`.
4. Add unit tests with synthetic stuck histories.

## Success Criteria
- [ ] Detects 3x repetition of `read(same_file)` -> same error.
- [ ] Detects 3x repetition of `bash(same_cmd)` -> same error.
- [ ] Injects intervention message.
- [ ] False positive rate < 1% (don't block legitimate iterative work like `read(chunk1)`, `read(chunk2)`).
