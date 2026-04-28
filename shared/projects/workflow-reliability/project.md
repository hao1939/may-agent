# Workflow Reliability

## Status
Active

## Owner
orchestrator

## Goal
Reduce workflow failures and increase end-to-end completion rate for master-worker iterations. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- Worker iteration success rate (file produced per iteration)
- Workflow crash/timeout rate
- Mean time from task assignment to deliverable

## Plan

### Milestone 1: Baseline Measurement
- Measure current worker success rate over last 14 days
- Document failure modes (no output, timeout, wrong task, repeated reads)
- Produce `outputs/workflow-reliability-baseline.md`

### Milestone 2: Add Guardrails
- Implement pre-flight checks: reject iterations that don't write within first 3 tool calls
- Add timeout escalation: if worker stalls, auto-cancel and reassign
- Test guardrails over 20 iterations

### Milestone 3: Sustained 90% Rate
- Track success rate for 7 consecutive days
- Tune thresholds based on data
- Close project when 90% target sustained for 1 week
