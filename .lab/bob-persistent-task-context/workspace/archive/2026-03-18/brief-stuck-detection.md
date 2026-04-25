# Design Brief: Common Sense Infra (Stuck Detection)

**Target**: Tech-Lead
**Context**: Common Sense item 3.3 ("Know when to stop") is currently purely behavioral. Agents often get stuck in loops (repeating tool calls) or fail to recognize when they are making no progress. We need an infrastructure mechanism to detect stuck sessions and surface warnings or trigger escalation.

## Design: Stuck Session Detector

### Mechanism
A lightweight heuristic in `monitor-session.md` (or a new `stuck-detection.ts` module) that analyzes the session history for:
1. **Repeated Tool Calls**: Calling the same tool with identical arguments 3+ times in a row.
2. **Repeated Errors**: Receiving the same error message 3+ times.
3. **No Progress**: 5+ turns with no file modifications or successful test runs.

### Action
When stuckness is detected:
1. **Inject Warning**: Inject a system message into the context: "WARNING: You seem stuck. You have repeated [action] X times. Pause and reflect. Consolidate your state or escalate."
2. **Escalate**: If stuckness persists (e.g., 2 more turns), trigger an automatic `handoff()` or `finish({ status: "blocked" })`.

### Implementation
- Create `agents/shared/skills/stuck-detection.md` (or `.ts` if built-in)
- Integrate into the `monitor-session` loop or `heartbeat-precheck`

## Deliverable
A brief confirming the implementation plan and target location.
