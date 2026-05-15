# EXP-630: Structural Duration Gate in genericHeartbeat()

## Date: 2029-07-02
## Status: DESIGNED
## Builds On: EXP-625 (skipped text version), EXP-620 (duration best proxy), EXP-520 (artifact gate), KE-480

## Problem Statement

EXP-620 found 55% of sessions are ultra-short (<60s) with trivial/no artifacts. EXP-520's artifact gate ensures *a* write happens but allows gate-gaming (trivial writes). EXP-625 designed a text-based duration awareness nudge, but KE-480 (6+ experiments) proves text interventions don't change behavior. We need a **structural** solution.

## Why Skip EXP-625 (Text Version)

1. **KE-480**: Text coaching is dead for behavioral changes. Duration awareness text will be ignored.
2. **Scenario ceiling**: EXP-610 found heartbeat-shallow-temptation at 100% baseline — can't measure improvement.
3. **EXP-625 design itself** acknowledges this: "If H1 fails (predicted by KE-480), the structural alternative is..."

## Hypothesis

**H1**: Adding a structural elapsed-time check to `genericHeartbeat()` that re-prompts agents when sessions complete in <90s will increase substantive artifact rate.

**H2**: The compound gate (artifact existence + duration ≥90s OR explicit justification) will reduce trivial/gate-gaming sessions from ~55% (EXP-620) to ≤25%.

## Proposed Code Change

In `agents/shared/workflows/heartbeat-data.ts`, after the existing artifact gate (line ~458), add a duration gate:

```typescript
// ── EXP-630: DURATION QUALITY GATE ──────────────────────────────
// Sessions completing in <90s are almost always trivial (EXP-620).
// Re-prompt once if session was suspiciously fast.
const elapsed = Date.now() - heartbeatStartTime; // capture start at top of function
const MINIMUM_DURATION_MS = 90_000; // 90 seconds
if (elapsed < MINIMUM_DURATION_MS && result.status !== "error") {
  ctx.emit({ type: "duration_gate_triggered", agent, elapsed_ms: elapsed });
  
  const durationPrompt = `⚠️ DURATION GATE: Your session completed in ${Math.round(elapsed/1000)}s — this is unusually fast.

Sessions under 90 seconds almost never produce substantive work. Before finishing:

1. Did you investigate at least one non-obvious issue?
2. Did you produce an artifact with real analysis (not just a status echo)?
3. Did you check for improvement opportunities beyond surface metrics?

If you genuinely completed meaningful work quickly, explain what you accomplished.
Otherwise, dig deeper into one project or metric and produce a substantive artifact.`;

  const durationResult = await ctx.runAgent(agent, durationPrompt);
  recordOutcome(agentsRoot, agent, durationResult.status === "error",
    durationResult.status === "error" ? "duration gate re-prompt error" : undefined);
  return ctx.done(ctx.summarize(durationResult, { maxLength: 500 }));
}
```

**Key**: Capture `const heartbeatStartTime = Date.now();` at the top of `genericHeartbeat()`.

## Method

### Phase 1: Code Implementation
1. Add `heartbeatStartTime` capture at top of `genericHeartbeat()`
2. Add duration gate check after artifact gate
3. Add event emission for monitoring

### Phase 2: Production Measurement (2 weeks)
1. Monitor `duration_gate_triggered` events
2. Compare pre/post artifact substance rates
3. Measure gate-gaming reduction

### Phase 3: Threshold Tuning
1. Analyze duration distribution of triggered vs non-triggered sessions
2. Adjust 90s threshold if needed

## Success Criteria
- Duration gate triggers on ≥20% of sessions (confirming shallow rate)
- Post-gate sessions produce substantive artifacts ≥80% of the time
- Overall shallow session rate drops from ~55% to ≤25%

## Risk Assessment
- **Over-triggering**: Some agents (evaluator, qa) legitimately have short sessions. May need agent-type allowlist.
- **Double gate**: Agent hits both artifact gate AND duration gate — need to handle ordering. Duration gate should only fire if artifact gate did NOT fire (they're separate problems).
- **Gaming**: Agent could stall to hit 90s. But stalling + producing an artifact is better than a 15s trivial write.

## Implementation Notes
- Duration gate fires AFTER artifact gate, only for sessions that DID produce a write but were very fast
- This complements EXP-520: artifact gate handles "no writes", duration gate handles "trivial writes"
- The two gates together create a compound quality signal

## Exit Criteria
- POSITIVE: Shallow rate ≤25% sustained for 2 weeks → permanent infrastructure
- NEGATIVE: Gate triggers but agents game it (pad with reads) → need byte-threshold or LLM quality check
- INCONCLUSIVE: Insufficient trigger volume → lower threshold or extend measurement
