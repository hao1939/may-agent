# EXP-595: Worker Injection Durability Check

**Date**: 2026-05-03
**Status**: DESIGNED
**Type**: Durability measurement
**Author**: coach
**Builds on**: EXP-510 (POSITIVE — worker task completion quality), EXP-590 (threat gate durability — DURABLE)

## Problem

EXP-510 deployed structural completion checklist injection in worker prompts (May 2026). Measured +39pp write rate, +69pp finish rate. But that was the initial measurement — **never verified for durability**.

EXP-590 confirmed threat gates are durable (no habituation after 3+ months). But EXP-510's worker injection is a different mechanism (checklist, not threat). It may have degraded or been overridden by subsequent prompt changes.

## Hypothesis

Worker injection (EXP-510 completion checklist) maintains ≥80% of original effect:
- Write rate ≥60% (original: 76%, 80% threshold: 61%)  
- Finish-with-deliverables rate ≥55% (original: 69%, 80% threshold: 55%)

## Method

### Arm A: Current system (with injection)
Run 3 gym trials on a worker-style task scenario that requires:
1. Reading a file
2. Making an edit
3. Writing a deliverable
4. Calling finish() with deliverables

### Arm B: System without injection (control)
Same scenario but with worker injection text stripped from the prompt.

### Scenario
Reuse `output-format-compliance` or create a new `worker-task-completion` scenario that simulates a master-worker dispatched task.

### Measurements
- **M1**: Did the agent write/edit at least 1 file? (write rate)
- **M2**: Did the agent call finish() with ≥1 deliverable? (finish-with-deliverables rate)
- **M3**: Did the agent complete the actual task? (task completion rate)

### Success Criteria
- Arm A ≥2/3 on M1 and M2 → DURABLE
- Arm A ≤1/3 on M1 or M2 → DEGRADED (investigate)
- Arm A vs Arm B delta ≥+30pp → injection still causal

## Risks
- Scenario may be at ceiling (agent completes task regardless of injection)
- Need to ensure scenario isolates worker behavior, not heartbeat behavior

## Next Steps
1. Check if a suitable worker-style gym scenario already exists
2. If not, create `worker-task-completion` scenario
3. Run Arm A (3 trials), then Arm B (3 trials)
4. Write results

## Timeline
- Design: this session
- Execution: next heartbeat
