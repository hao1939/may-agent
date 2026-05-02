# EXP-511: Empty-Response Loop Detection and Recovery

**Status**: OPEN
**Created**: 2026-07-01
**Author**: coach
**Type**: Structural intervention

## Problem

Recent evaluations (s_1777483248275_448, s_1777483248263_447, s_1777483248236_446) show a recurring failure mode: agents produce **blank/empty responses** across multiple retry iterations, then loop when the system prompts "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES." This differs from the non-delivery problem EXP-510 addressed — EXP-510 added completion requirements to prompts, but the failure here is agents not making ANY tool calls at all, resulting in empty assistant turns.

### Failure Pattern
1. Agent receives task
2. Agent returns empty response (no tool calls, no text)
3. System detects 0 files, retries with stronger prompt
4. Agent again returns empty or narrative-only response
5. Loop continues 4-28 times with no progress

### Frequency
- 3 of 4 most recent evaluations show this pattern
- Affects both optimizer and coach agents
- Correlated with multi-iteration retry logic (ironic: retries make it worse)

## Hypothesis

**H1**: The retry escalation prompt ("YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES") triggers a defensive/confused state in the LLM, making subsequent attempts MORE likely to fail, not less. Adding more constraints (WRITE-FIRST, EDIT-FIRST) further overwhelms.

**H2**: A simpler, reset-style re-prompt — stripping accumulated failure context and presenting a fresh, minimal task — will produce better recovery than escalating pressure.

## Design

### Arms
- **Arm A (Control)**: Current retry behavior — escalating constraints on each retry
- **Arm B (Treatment)**: "Clean slate" retry — on detecting empty response, strip all previous iteration context and re-issue original task with only a single addition: "Start by calling write() to create your first output file."

### Measurement
- **Primary**: Tool-call rate in first 3 tool calls after retry (binary: ≥1 tool call = success)
- **Secondary**: File production rate per session
- **Tertiary**: Overall eval quality score

### Implementation Location
Likely in `master-worker.ts` or wherever retry logic lives for 0-file detection.

### Sample Size Target
- n=10 per arm minimum (expect ~20 retry events over 2 weeks)

## Success Criteria
- Arm B shows ≥30pp improvement in tool-call rate after retry vs Arm A
- No regression in quality scores for sessions that don't trigger retry

## Related
- EXP-510: Structural worker completion (addressed non-delivery at prompt level — POSITIVE)
- EXP-520: Post-finish artifact gate (reactive recovery — POSITIVE)
- KE-180: Analysis gates harm — agents feel done after analysis, skip fix

## Next Steps
1. Audit the retry logic in master-worker.ts to understand current escalation
2. Build treatment arm (clean-slate retry)
3. Run A/B with session tagging for measurement
