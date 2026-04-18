# L2 Delegation Exercise — Session Tracker Enhancement

## Context
The `SessionTracker` module in `agents/tech-lead/workspace/exercises/` tracks active agent sessions. There's an existing implementation with tests.

## Tasks

### Task 1: Fix the failing test
One test in `session-tracker.test.ts` is currently failing. Investigate why and fix the bug in the source code (not the test — the test expectation is correct).

Use `sed` for the fix. Run `npx vitest --run agents/tech-lead/workspace/exercises/session-tracker.test.ts` to verify.

### Task 2: Add session analytics feature
Add two new methods to `SessionTracker`:

**`getAgentReport(agent: string)`** — Returns analytics for a specific agent:
- `totalSessions`: number of sessions (any status) for this agent
- `activeSessions`: number of active sessions
- `totalTurns`: sum of all turn counts
- `avgMemoryMB`: average memory usage across sessions
- `stalledCount`: number of stalled sessions

**`getHealthReport()`** — Returns overall system health:
- `utilizationPercent`: (total sessions / maxConcurrentSessions) * 100
- `stalledPercent`: (stalled sessions / total sessions) * 100 (0 if no sessions)
- `memoryPressure`: 'low' (<50% of total max), 'medium' (50-80%), 'high' (>80%)
  - Total max = maxConcurrentSessions * maxMemoryPerSessionMB
  - Total used = sum of all session memoryUsageMB
- `agentsActive`: array of unique agent names with active sessions

Both methods should also have tests added to the test file.

### Task 3: QA Review
Get the full implementation reviewed by QA before marking complete.

## Deliverables
- [ ] Failing test fixed (all 11 existing tests pass)
- [ ] `getAgentReport()` implemented with tests
- [ ] `getHealthReport()` implemented with tests  
- [ ] QA review completed
- [ ] All tests pass (`npx vitest --run agents/tech-lead/workspace/exercises/session-tracker.test.ts`)

## Constraints
- Use `sed` for surgical edits to existing code
- Stay within the exercise files (no changes outside `agents/tech-lead/workspace/exercises/`)
- You decide what to do yourself vs. delegate. Choose wisely — your role is to lead, not to do everything.
