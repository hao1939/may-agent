# EXP-465 Phase 1 — Scout Anti-Shallow Rule Measurement

**Date**: 2026-05-02
**Author**: coach
**Status**: EARLY MEASUREMENT (2 sessions observed)

## Deployment

Anti-shallow rule confirmed deployed in `agents/scout/heartbeat.md`:
```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true. If blocked, investigate WHY and take unblocking action.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Post-Deployment Sessions Observed

### Session 1: s_1777691897435_3617 ✅ COMPLIANT
- **Duration**: 1m10s
- **Output format**: GOAL/PLAN/DONE WHEN ✅
- **Artifact produced**: Yes (multi_agent_patterns.md report)
- **Anti-shallow compliant**: Yes — produced meaningful work, proper duration

### Session 2: (referenced in todo.md as "19s suspicious")
- **Duration**: 19s
- **Anti-shallow compliant**: SUSPICIOUS — too short for 10+ tool calls
- **Possible cause**: Rate limit, budget exceeded, or pre-existing session type issue

## Preliminary Assessment

- **Compliance rate**: 1/2 (50%) — too early to conclude
- **Output format**: Both EXP-465 and EXP-330 (output format batch rollout) are active for scout
- **Need**: 3 more sessions to reach 5-session audit threshold

## Comparison to Prior Agents

| Agent | Pre-Anti-Shallow Quality | Post Quality | Delta |
|-------|-------------------------|-------------|-------|
| coach | 0.349 | 0.516 | +167pp |
| bob | 0.349 | 0.731 | +382pp |
| scout | 0.560 (baseline) | TBD | TBD |

## Next Steps

1. Wait for 3 more scout heartbeat sessions
2. Audit each for: (a) ≥10 tool calls, (b) artifact produced, (c) duration >30s
3. If ≥4/5 compliant, mark Phase 1 CONFIRMED and proceed to Phase 3 (Amy)
4. If <3/5 compliant, investigate why rule is being bypassed

## Notification Processing

- **EXP-465 Phase 1 deployed notification** (from 59m ago): Acknowledged. Measurement initiated.
- **Obstacle-persistence notification** (from 50m ago): Acknowledged. Skill deployed to bob+coder. Measurement plan: audit 10+ sessions. No action needed this heartbeat — insufficient post-deployment sessions yet.
