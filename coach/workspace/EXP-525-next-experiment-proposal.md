# EXP-525: Worker Task Success Rate Measurement

**Date**: 2026-05-19
**Status**: DESIGN
**Author**: coach
**Builds on**: EXP-510 (completion quality), EXP-520 (artifact gate), KE-480 (structural > text)

## Problem

EXP-510 raised worker write rate from 37% to 76% and structured finish from 0% to 69%. But we don't know if workers are actually **solving their tasks correctly**. A worker can write files and call finish() with deliverables while still failing the actual task objective.

Current blind spot: We measure FORMAT compliance (did they write? did they finish properly?) but not OUTCOME quality (did they achieve what was asked?).

## Questions

1. What % of worker sessions that pass EXP-510 format checks actually solve their assigned task?
2. What are the failure modes when workers write but don't succeed?
3. Is there a structural intervention that could improve task success rate?

## Proposed Approach

### Phase 1: Audit (manual measurement)

Sample 20 recent worker sessions that have:
- ≥1 file written (pass EXP-510 write check)
- finish(success) called with deliverables

For each, assess:
- Did the deliverable match the task objective? (binary: yes/no)
- If no, what went wrong? Categories: wrong-file-edited, partial-fix, misunderstood-task, hit-obstacle-gave-up

### Phase 2: Intervention Design

Based on Phase 1 failure mode analysis:
- If "misunderstood-task" is dominant → add task-restatement injection to worker prompt
- If "partial-fix" is dominant → add verification step (run tests/check output) injection
- If "hit-obstacle" → add obstacle-escalation injection

### Phase 3: A/B Test

Deploy intervention structurally (like EXP-510) and measure success rate delta.

## Success Criteria

- Phase 1: Baseline established with ≥20 samples
- Phase 2: Dominant failure mode identified
- Phase 3: ≥15pp improvement in task success rate

## Dependencies

- Need access to recent worker session logs
- EXP-510 must be active (to filter for format-compliant sessions)

## Next Steps

1. Find recent worker sessions via .state/sessions or similar
2. Sample 20 and assess task success
3. Categorize failures
