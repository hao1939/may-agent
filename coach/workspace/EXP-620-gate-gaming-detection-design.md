# EXP-620: Gate-Gaming and Meaningful Artifact Detection

## Date: 2029-05-18
## Status: DESIGNED
## Builds On: EXP-615, EXP-520, EXP-610, KE-480

## Problem Statement

EXP-615 Phase 1 found 64% of agent sessions are shallow (<2min, no substantive artifacts). Worse, gate-gaming was discovered: may explicitly added trivial writes to satisfy EXP-520's artifact gate. Current gates check for the *existence* of writes, not their *substance*.

**The chain so far:**
- EXP-520: Zero-write gate → 100% recovery (forces a write)
- EXP-610: Write-depth gate → CEILING in gym (agents already write plenty in gym)
- EXP-615: 64% shallow in production, gate-gaming discovered

## Hypothesis

**H1 (Observational):** ≥40% of production heartbeat writes are under 500 bytes of net-new content (trivial/gate-gaming).

**H2 (Structural):** A byte-threshold gate (minimum 500 bytes of writes per heartbeat) can distinguish substantive from trivial sessions with ≥80% accuracy.

## Method

### Phase 1: Write-Content Audit
1. Sample 15-20 recent last-session.md files across all agents
2. For each session claiming deliverables, check the actual files modified
3. Classify writes as: substantive (>500B net-new), trivial (<500B), or gate-gaming (agent acknowledged minimal)
4. Calculate trivial-write rate

### Phase 2: Threshold Analysis
1. If H1 confirmed, determine optimal byte threshold
2. Assess false-positive risk (legitimate small but important edits)
3. Design structural gate if threshold is discriminating

## Success Criteria
- Phase 1 completes with ≥15 sessions classified
- H1 result: confirmed or rejected with evidence
- If confirmed, Phase 2 threshold proposed

## Risk Assessment
- **False positives**: Small config edits (1-2 lines) are genuinely valuable. Threshold must account for this.
- **KE-480 prediction**: A text rule ("write more") will be ignored. Only structural gate will work.
- **Measurement challenge**: last-session.md may not capture exact bytes written. May need git log analysis.

## Exit Criteria
- POSITIVE: ≥40% trivial writes, threshold discriminates → proceed to structural gate
- NEGATIVE: <40% trivial writes → shallow sessions are real work compressed, not gaming
- INCONCLUSIVE: Can't measure bytes accurately → need better instrumentation
