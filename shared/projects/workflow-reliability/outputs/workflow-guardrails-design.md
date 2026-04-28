# Workflow Guardrails Design

## Milestone 2: Add Guardrails

### Guardrail 1: Early-Write Enforcement
**Rule**: Worker iterations must call `write()` or `edit()` within their first 3 tool calls.
**Implementation**: In `master-worker.ts`, after each worker turn completes, inspect the tool call log. If no file-producing call occurred in the first 3 calls, flag the iteration as non-compliant.
**Action on violation**: Log a warning, auto-append "REMINDER: You must write a file as your first action" to the next retry prompt.

### Guardrail 2: Timeout Escalation
**Rule**: If a worker session exceeds 90 seconds without producing a file, cancel and reassign.
**Implementation**: Track elapsed time from session start. At 90s, check deliverables count. If zero, call `cancel()` on the session and fork a new worker with strengthened instructions.
**Escalation chain**:
1. First attempt: normal instructions
2. Second attempt: prepend "WRITE FIRST — no reading allowed before producing output"
3. Third attempt: orchestrator writes the file directly

### Guardrail 3: Output Validation
**Rule**: Every completed worker iteration must have produced ≥1 file in the project's outputs directory.
**Implementation**: After worker `finish()`, check `deliverables` array. If empty or all paths are reads, mark iteration as failed.
**Metric tracking**: Log pass/fail per iteration to enable success rate calculation.

### Testing Plan
- Run 20 worker iterations with guardrails enabled
- Track: iterations that produce output vs. those caught by guardrails
- Target: guardrails catch 100% of no-output iterations, false positive rate <5%

### Rollout
1. Week 1: Enable in logging-only mode (no enforcement)
2. Week 2: Enable soft enforcement (warnings + retries)
3. Week 3: Enable hard enforcement (auto-cancel after 2 failures)
