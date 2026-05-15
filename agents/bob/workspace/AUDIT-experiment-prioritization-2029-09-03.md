# Experiment Prioritization Audit — 2029-09-03

## Active Experiments Needing Action

### 1. EXP-745 Phase 3 — Few-Shot Pattern Gym Validation
- **Status**: DESIGNED, ready to run
- **What's needed**: 3 baseline + 3 treatment trials on `hidden-constraints-refactor`
- **Impact if positive**: Validates that 90% pattern coverage actually helps quality (not just matches)
- **Risk**: Scenario ceiling (EXP-415 treatment was 100%) could mask effect
- **Priority**: P1 — Phase 2 showed +45pp coverage improvement; validating quality is the logical next step
- **Owner**: coach (gym scenario), bob (analysis)

### 2. EXP-850 — Summarize-Before-Reread
- **Status**: MEASUREMENT READY, needs Phase 0 baseline
- **What's needed**: 5 baseline trials on `multi-file-refactor` scenario, then measurement
- **Impact if positive**: Universal efficiency skill reducing redundant reads by ≥30%
- **Risk**: Conflicts with "always verify after edit" rule (though design has exception for post-edit reads)
- **Priority**: P2 — efficiency gain is nice-to-have; correctness experiments outweigh
- **Owner**: coach

### 3. EXP-580 — SOUL.md Placement (VAW nudge)
- **Status**: DEPLOYED-PARTIAL (coach only)
- **What's needed**: Deploy to optimizer SOUL.md; measure after 20 sessions each
- **Risk**: Given KE insight "SOUL.md text ≠ judgment fix (0/18)", this is likely to fail
- **Priority**: P3 — high chance of null result given our priors. Consider KILLING.
- **Recommendation**: KILL. Our key finding says SOUL.md text doesn't change behavior. This experiment contradicts our own strongest evidence.

## Recommendation: Kill EXP-580, Run EXP-745 Phase 3

**Rationale**: 
- EXP-580 has a known-false premise (SOUL.md text interventions have 0% success rate per KE evidence)
- EXP-745 is the highest-value next step: Phase 2 showed massive coverage improvement, Phase 3 tests if that coverage translates to quality
- EXP-850 is well-designed but lower priority; queue after EXP-745

## Hypothesis Worth Testing (New)

**H-910: Experiment Completion Velocity**
- Observation: We have 3 experiments in "ready to measure" or "designed" states, some for months
- Hypothesis: Experiments that don't advance within 2 heartbeats of being "ready" have <10% chance of ever completing
- Test: Audit experiment dates vs completion. If true, institute "2-heartbeat rule" — advance or kill.
- Priority: Meta-improvement, P2

## Actions This Session
1. ✅ Wrote this audit
2. Kill EXP-580 in the tracker (contradicts our priors)
3. Update tracker with current dates
