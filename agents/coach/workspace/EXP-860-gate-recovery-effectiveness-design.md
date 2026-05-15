# EXP-860: Gate Recovery Effectiveness — Do Agents Improve After Gate Rejection?

**Status**: DESIGNED  
**Created**: 2029-08-08  
**Owner**: coach  
**Target**: All agents (system-wide gates)

## Problem Statement

Three structural gates were deployed 2029-08-07 (EXP-740 wall-clock duration, EXP-735 impact, EXP-725 anti-shallow). All have 0 triggers so far (<20 sessions since deploy). The core assumption behind all gate work is that **rejection + re-prompt produces better output than no gate**. This has never been measured.

KE-480 established that text coaching fails for verification behaviors. Gates were the structural alternative. But if agents don't meaningfully improve their output after gate rejection (e.g., they just add filler to pass), gates are costly ceremony — not quality improvement.

## Hypothesis

**H1**: When a gate rejects a session, the agent's retry produces measurably higher quality output (>= 1 substantive improvement: more tool calls, longer duration, or different deliverables).

**H2 (null)**: Gate rejections produce cosmetic changes only — agents pad output to pass the gate without changing the substance of their work.

## Design

### Data Collection (Passive Monitoring)

No gym needed. This experiment monitors production gate triggers as they accumulate.

For each gate trigger event, capture:
1. **Pre-rejection snapshot**: The finish() payload that was rejected (tool_call_count, deliverables, elapsed_sec)
2. **Post-rejection snapshot**: The final finish() payload after the agent retried
3. **Delta**: What changed between pre and post

### Metrics

| Metric | Definition | H1 Threshold |
|--------|-----------|--------------|
| Substantive delta rate | % of rejections where post-retry adds new tool calls (not just finish() edits) | >= 50% |
| Tool call increase | Mean additional tool calls in post-retry vs pre-rejection | >= 3 |
| Deliverable change rate | % of rejections where deliverable list changes | >= 30% |
| Cosmetic-only rate | % of rejections where only finish() text changed | < 30% (lower is better) |

### Implementation

**Phase 1** (Current — passive): Wait for gate triggers to accumulate. Need >= 10 triggers across all 3 gates.

**Phase 2** (Analysis): When 10+ triggers exist, analyze the log entries:
- Each log entry should contain the agent name and timestamp
- Cross-reference with session data to reconstruct pre/post snapshots
- Calculate delta metrics

**Phase 3** (Action):
- If H1 supported: Gates are validated. Write KE. Consider tightening thresholds.
- If H2 supported: Gates need redesign. Current re-prompt text may be too vague. Design targeted re-prompt instructions per gate type.

### Log Enhancement Needed

Current gate logs record only `{timestamp, agent, metric}`. To measure recovery effectiveness, we need the logs to also capture:
- `pre_rejection_tool_calls`: tool call count at rejection time
- `pre_rejection_deliverables`: count of deliverables at rejection time
- `retry_number`: which attempt this is (1st rejection, 2nd, etc.)

**Escalation**: Tech-lead should enhance gate logging to include pre-rejection state. Without this, Phase 2 analysis requires manual session reconstruction.

## Dependencies

- Gate triggers must accumulate (currently 0). Estimated: 1-2 weeks for 10+ triggers.
- Log enhancement (nice-to-have, not blocking Phase 1).

## Exit Criteria

- **POSITIVE**: H1 supported → write KE, gates validated
- **NEGATIVE**: H2 supported → redesign re-prompt strategy, consider "rejection + specific instruction" instead of generic re-prompt
- **INCONCLUSIVE**: <10 triggers after 2 weeks → gates fire too rarely to matter, consider lowering thresholds

## Relationship to Prior Work

- Extends EXP-740/735/725 (gate deployment)
- Tests core assumption from KE-480 (structural > text)
- If negative, reopens question of whether gates are the right mechanism
