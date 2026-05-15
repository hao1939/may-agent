# EXP-860: Dev Agent Read-Redundancy Reduction

**Status**: DESIGNED
**Created**: 2029-08-06
**Owner**: Bob
**Origin**: EXP-850 proxy baseline finding F2

## Hypothesis

Adding a "check session context before re-reading" nudge to dev agent guidance will reduce dev's read-redundancy rate from ~33% to ≤15%, saving ~1-2 tool calls per session without quality regression.

## Background

EXP-850 proxy analysis (19 production sessions) found:
- Dev agent re-reads files it already has in context 33% of the time
- All other agents are below 15%
- Dev is the clear outlier and highest-ROI target

EXP-850 also showed that *generic* efficiency nudges don't work (NEGATIVE result). This experiment tests whether a **specific, actionable** nudge targeting a concrete behavior (redundant reads) succeeds where vague efficiency instructions failed.

## Design

### Intervention
Add to dev agent context/guidance:
```
## Read Efficiency
Before calling read() on a file, check if you already read it this session.
If you did: use what you learned from the earlier read. Only re-read if:
- You need to verify an edit you just made
- The file was modified by a bash command since your last read
```

### Arms
- **A (baseline)**: Current dev agent behavior (no change)
- **B (targeted nudge)**: Dev agent with the read-efficiency guidance above

### Measurement
- **Primary metric**: Read-redundancy rate (% of read() calls that target a file already read this session, excluding post-edit verification reads)
- **Guard rail**: Task completion rate must not drop
- **Sample**: 10 dev sessions per arm (natural production sessions, before/after deployment)

### Success Criteria
- Read-redundancy rate drops from ~33% to ≤15%
- No decrease in task completion quality

## Why This Differs From EXP-850

EXP-850 tested *generic* efficiency nudges ("be efficient" / "use ≤15 tool calls"). Those failed because:
1. The agent was already near-optimal on simple tasks
2. The instruction was vague — no specific behavior to change

EXP-860 targets a **specific, measurable behavior** (re-reading files) with a **concrete rule** (check if already read). This follows KE-715's principle: concrete thresholds > vague instructions.

## Phase 0: Pre-Deployment Baseline
1. Sample 10 recent dev sessions from logs
2. Count total read() calls and redundant read() calls per session
3. Confirm the 33% redundancy rate from EXP-850 still holds

## Phase 1: Deploy & Measure
1. Add the nudge to dev agent guidance
2. Wait for 10 natural dev sessions
3. Measure the same metrics
4. Compare

## Risks
- Low: read-only behavioral nudge, easily reversible
- Dev might over-suppress reads and miss file changes → guard rail catches this
