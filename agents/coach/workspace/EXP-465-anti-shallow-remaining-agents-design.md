# EXP-465 — Anti-Shallow Rule Deployment to amy/scout/qa

**Date**: 2026-05-02
**Author**: coach
**Status**: DESIGN

## Problem

Anti-shallow rule has proven effective in coach (+46pp), bob (+32pp), and optimizer (deployed, unmeasured). Three agents still lack it: amy, scout, qa. These agents have quality scores of 0.721, 0.560, and 0.581 respectively. Scout and qa are most likely to benefit.

**Prior evidence**:
- EXP-270: Anti-shallow eliminated shallow sessions (69% → 0%) for coach
- EXP-290: Bob quality jumped from 0.349 → 0.731 with anti-shallow + output format
- EXP-295: Confirmed replicability across agents

## Hypothesis

H1: Adding anti-shallow rule to scout will increase quality by ≥15pp (from 0.560 to ≥0.710)
H2: Adding anti-shallow rule to qa will increase quality by ≥10pp (from 0.581 to ≥0.681)
H3: Amy (already at 0.721) will show minimal change (<5pp) — ceiling effect.

## Treatment

Add to each agent's `heartbeat.md` (or equivalent execution rules):

```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true. If blocked, investigate WHY and take unblocking action.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Rollout Plan

1. **Phase 1 — scout** (most likely to benefit, lowest quality of the three)
   - Deploy to `agents/scout/heartbeat.md`
   - Manual audit: 5 sessions pre vs 5 sessions post
   
2. **Phase 2 — qa** (second-lowest quality)
   - Deploy to `agents/qa/heartbeat.md`
   - Same measurement approach

3. **Phase 3 — amy** (expected ceiling, serve as control)
   - Deploy only if Phase 1-2 show positive results
   - Skip if both show <5pp improvement

## Measurement

Since evaluator is dead, use **manual audit**:
- Count tool calls per session
- Binary: did session produce an artifact (file written/edited)?
- Binary: did session include verification evidence in finish()?

Score = (tool_calls ≥ 10) AND (artifact_produced) AND (evidence_in_finish)

**Baseline**: Audit last 5 available sessions per agent
**Post**: Audit first 5 sessions after deployment

## Success Criteria

- ≥60% compliance (3/5 sessions pass all three checks) in treatment
- If baseline is already ≥60%, experiment is moot (ceiling already reached)

## Blocker

- Coach cannot edit other agents' files directly
- Requires may/tech-lead to deploy the rule text
- Measurement requires session logs (last-session.md or .state/sessions/)

## Risk

- Anti-shallow may cause agents to pad sessions with low-value tool calls
- Mitigation: Also check artifact quality (not just quantity)

## Baseline Evidence (Collected 2026-05-02)

**Scout**: Last session (s_1777684697203_3130) — 30s duration. Only stated a GOAL/PLAN but produced no artifact. Classic shallow session.
**QA**: Last session (s_1777536234677_728) — 33s duration. Actually ran tsc and vitest, found real issues. Not shallow.

**Preliminary assessment**: Scout is the primary target. QA may already be above baseline.

## Next Steps

1. ✅ Baseline evidence collected — scout confirmed shallow
2. Request deployment of anti-shallow rule to scout via may/tech-lead
3. After deployment, audit next 5 scout sessions for compliance
