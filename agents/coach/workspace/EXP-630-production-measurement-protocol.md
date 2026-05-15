# EXP-630: Production Measurement Protocol

## Date: 2029-07-14
## Status: MEASUREMENT IN PROGRESS

## Context

EXP-630 structural duration gate has been deployed in `agents/shared/workflows/heartbeat-data.ts` (lines 463-486). The implementation:
- Captures `heartbeatStartTime` at function start
- Checks if `elapsed < 90_000ms` after agent completes
- Re-prompts with substantive work questions if too fast
- Emits `duration_gate_triggered` event for monitoring

## Measurement Challenge

The `duration_gate_triggered` event is emitted via `ctx.emit()` but there's no persistent log sink visible in the filesystem. Last-session.md files don't record gate triggers. We need an alternative measurement approach.

## Alternative Measurement Approach

### Method 1: Session Duration Proxy (Available Now)
Since we can't directly observe gate triggers, measure the *outcome*:
- **Pre-deployment baseline** (EXP-620): 55% of sessions <60s, 59% <90s
- **Post-deployment target**: ≤25% of sessions <90s
- **How to measure**: The anti-shallow rule already requires ≥10 tool calls. If the duration gate is firing, sessions that *would* have been <90s should now run longer.

### Method 2: Artifact Quality (Manual Audit)
Audit 20 recent last-session.md files for:
- Substantive deliverables listed (not just status echoes)
- Multiple meaningful writes (>200 bytes each)
- Non-trivial investigation evidence

### Method 3: Code Path Analysis
The gate returns early after re-prompt (`return ctx.done(...)`). If sessions are going through the gate, the re-prompt response would be the final output. Look for sessions where the agent was asked "Did you investigate at least one non-obvious issue?" in their context.

## Preliminary Observations (2029-07-14)

From last-session.md audit across 6 agents:
- All sessions show `status: done` (not error)
- No direct evidence of duration gate triggering visible in session metadata
- Sessions have recent timestamps (within last 24h), meaning post-deployment

## Interpretation Options

1. **Gate never fires**: All sessions already take >90s (unlikely given 59% baseline)
2. **Gate fires but no trace**: Events emitted but not persisted to filesystem
3. **Behavioral shift**: The ANTI-SHALLOW rule text (≥10 calls) + duration gate threat in heartbeat.md is *preventing* fast sessions proactively (agents read their instructions and self-regulate)

## Recommended Next Steps

1. **Add logging**: Modify duration gate to write a line to a log file when it fires:
   ```typescript
   // After ctx.emit, add:
   fs.appendFileSync(path.join(agentsRoot, agent, 'duration-gate.log'), 
     `${new Date().toISOString()} triggered elapsed=${elapsed}ms\n`);
   ```

2. **Measure indirectly**: Count tool calls in recent sessions via session transcripts (if available). If minimum is consistently >10 and sessions >90s, the gate may be preventing rather than catching.

3. **Targeted test**: Temporarily lower threshold to 120s or 150s to catch more sessions and confirm the mechanism works.

## Decision Criteria

| Outcome | Action |
|---------|--------|
| Gate fires ≥20% AND recovery ≥80% | CLOSE ✅ POSITIVE |
| Gate fires <5% (all sessions already long) | CLOSE ✅ POSITIVE (preventive effect) |
| Gate fires but agents game it (trivial re-prompt responses) | Increase threshold or add byte check |
| Cannot measure after 2 weeks | Add filesystem logging, re-measure |

## Relationship to EXP-635

EXP-635 (threat-framed depth commitment) is DESIGNED but blocked by EXP-610's finding that `heartbeat-shallow-temptation` is at ceiling. If EXP-630 measurement shows the production shallow rate is already ≤25%, EXP-635 becomes unnecessary.

**Recommendation**: Hold EXP-635 until EXP-630 measurement completes. If shallow rate is still >25% post-EXP-630, then EXP-635's threat framing may add incremental value.
