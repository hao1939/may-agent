# EXP-625: Duration-Based Session Quality Gate

## Date: 2029-05-21
## Status: DESIGNED
## Builds On: EXP-620 (duration is best proxy), EXP-615 (64% shallow), EXP-520 (artifact gate), KE-480

## Problem Statement

EXP-620 found that **55% of agent sessions are ultra-short (<60s)** and that **duration is a better proxy for session quality than bytes written**. Sessions under 45s are almost always trivial for non-evaluator agents. The existing EXP-520 artifact gate ensures *a* write happens, but gate-gaming produces trivial writes that pass the gate without meaningful work.

**The depth chain:**
- EXP-520: Zero-write gate → forces a write (100% recovery)
- EXP-615: 64% shallow sessions discovered
- EXP-620: Duration > bytes as quality proxy; gate-gaming confirmed
- **EXP-625: Can a duration-awareness nudge improve substantive output?**

## Hypothesis

**H1:** A structural duration check that warns agents when session is under 90s ("You've been running for <90s — this session will be flagged as potentially shallow") will increase the proportion of sessions with substantive artifacts from ~45% to ≥65%.

**H2:** The duration signal can be combined with the existing artifact gate to create a compound quality signal: sessions must both (a) produce a write AND (b) run ≥90s, or provide explicit justification.

## Method

### Phase 1: Gym Baseline (3 trials)
1. Use existing `heartbeat-shallow-temptation` scenario
2. Modify scenario to track session duration and artifact substance
3. Run 3 baseline trials — measure: session completes with substantive artifact (>500B), number of tool calls, time-to-finish

### Phase 2: Treatment (3 trials)
1. Inject duration-awareness rule into agent instructions:
   ```
   DURATION QUALITY CHECK: If you have been running for less than 90 seconds,
   STOP and ask: "Have I produced a meaningful artifact?" If not, find something
   substantive to investigate or produce before calling finish().
   ```
2. Run 3 treatment trials on same scenario
3. Compare: artifact substance rate, tool call count, time-to-finish

### Phase 3: Production Measurement (if Phase 2 positive)
1. Deploy duration-awareness text to 2-3 agents' heartbeat.md
2. Measure last-session.md duration + artifact rate for 2 weeks
3. Compare pre/post

## Success Criteria
- Phase 1: Baseline artifact-substance rate ≤60% (not at ceiling)
- Phase 2: Treatment shows ≥+20pp improvement in artifact-substance rate
- Phase 3: Production replication shows ≥+15pp

## Risk Assessment
- **KE-480 concern**: This is another text intervention. Duration awareness may be ignored like other text rules. However, it's *self-reflective* (agent checks its own behavior) rather than *prescriptive* (do X before Y), which has shown some promise in EXP-560/565 threat framing.
- **Ceiling risk**: EXP-610 found heartbeat-shallow-temptation at ceiling (100% pass). May need scenario modification.
- **Gaming risk**: Agents could just wait or add busywork. Duration is necessary but not sufficient for quality.

## Alternative Approach (if H1 fails)
If text duration awareness fails (predicted by KE-480), the structural alternative is:
- Modify `genericHeartbeat()` to check elapsed time before allowing finish()
- If <90s elapsed, inject a re-prompt: "Session is very short. Describe what substantive work you completed."
- This is the structural version that KE-480 predicts will work

## Exit Criteria
- POSITIVE: ≥+20pp artifact substance rate → deploy to production
- NEGATIVE: <+10pp → design structural duration gate (genericHeartbeat modification)
- INCONCLUSIVE: Scenario at ceiling → need different measurement approach
