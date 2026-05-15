# EXP-635: Threat-Framed Depth Commitment for Substantive Work

## Date: 2029-07-04
## Status: DESIGNED
## Builds On: EXP-560/565 (threat framing +100pp), EXP-390 (anti-shallow threshold), EXP-620 (55% shallow), KE-480

## Problem Statement

The anti-shallow rule (≥10 tool calls) prevents empty sessions but doesn't ensure *substantive* work:
- 59% of last sessions are still <90s (current measurement from last-session.md audit)
- EXP-620 confirmed gate-gaming: agents make trivial reads/writes to satisfy the count
- EXP-390 found the threshold value doesn't matter — binary "prevents empty" is the only effect

Meanwhile, EXP-560/565 proved **threat-of-rejection framing** creates +100pp behavior change where awareness text fails. The anti-shallow rule is currently framed as an awareness nudge ("MUST make at least 10 tool calls"). Reframing as threat-of-rejection may change behavior.

## Hypothesis

**H1**: Replacing the awareness-framed anti-shallow rule with a threat-framed version that emphasizes *substantive* work (not just count) will produce deeper sessions in gym.

**H2**: Agents given the threat-framed rule will produce ≥2 meaningful artifacts per session vs ≤1 for awareness-framed.

**Operationalization**: In a heartbeat-simulation gym scenario, treatment arm produces more writes, longer sessions, and fewer trivial reads compared to baseline.

## Arms

### Arm A — Baseline (current anti-shallow rule)
```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish(). 
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE.
```

### Arm B — Threat-Framed Depth Commitment
```
⚠️ SESSION REJECTION GATE (P0):
- Your session is AUTOMATICALLY REJECTED and marked FAILURE if:
  1. You make fewer than 10 SUBSTANTIVE tool calls (re-reading the same file doesn't count)
  2. You produce fewer than 2 meaningful artifacts (files created/modified with >200 bytes of new content)
  3. Your session completes in under 90 seconds
- "Nothing to do" triggers immediate rejection. Find work or investigate why you think there's nothing.
- Padding with trivial reads is detected and counted as a violation.
```

## Method

1. **Scenario**: Use `heartbeat-shallow-temptation` (existing) — tests whether agent does real work when tempted to declare "all done"
2. **Modify**: Create variant `heartbeat-shallow-temptation-exp635-threatgate` with Arm B in coaching
3. **Trials**: 3 baseline, 3 treatment
4. **Measures**:
   - Primary: Number of meaningful writes (>200 bytes new content)
   - Secondary: Total distinct files read (not re-reads), session elapsed tool calls
   - Tertiary: Qualitative assessment of artifacts produced

## Success Criteria

- Treatment produces ≥+30pp more meaningful artifacts than baseline
- OR treatment shows measurably different tool-call pattern (fewer redundant reads, more writes)

## Risks

- EXP-610 found heartbeat-shallow-temptation at 100% ceiling (3/3, 7-10 files)
- If baseline is still at ceiling, this experiment is moot
- **Mitigation**: If baseline is at ceiling again, CLOSE immediately and note that the 59% shallow problem is production-specific (real inbox with "nothing to do" signals), not reproducible in gym

## Dependencies

- None — can be run immediately in gym
- Does NOT require tech-lead implementation

## Next Steps

1. Verify `heartbeat-shallow-temptation` baseline hasn't drifted (quick 1-trial check)
2. If not at ceiling: create treatment variant, run 3×3
3. If at ceiling: close and design production-measurement approach instead
