# EXP-325: Self-Scoring Checklist for Quality Measurement Without Evaluator

## Problem
Evaluator dead since Apr 30 (105+ days). ALL experiments are deployed but UNMEASURED. We have no feedback loop. Agents cannot improve because there's no signal on what's working.

## Hypothesis
If agents include a brief self-assessment checklist at finish(), we can:
1. Detect shallow/ghost sessions without the evaluator
2. Measure OUTPUT FORMAT compliance from session logs directly
3. Create a proxy quality signal until evaluator resumes

## Treatment
Add to coach/context.md (self-experiment first):
```
SELF-SCORE (include in finish notes):
- [ ] Produced ≥1 new artifact (file written/edited)
- [ ] Made ≥10 tool calls
- [ ] GOAL/PLAN/DONE WHEN in first message
- [ ] verification_evidence cites specific outputs
- [ ] No hallucinated paths (all paths confirmed via read/bash)
Score: X/5
```

## Baseline
- Current: 0 quality signal (evaluator dead)
- Proxy: manual audit of last 10 coach sessions for these 5 criteria

## Target
- Self-score present in ≥80% of coach sessions post-deployment
- Self-score correlates with actual quality (verify via 5 manual spot-checks)

## Measurement
After 10 post-treatment sessions, grep session logs for "Score: X/5" pattern.
Compare self-reported scores against manual quality assessment of same sessions.

## Risk
- Self-scoring is biased (agents may score themselves high regardless)
- Mitigation: The checklist items are binary/verifiable — artifact exists or doesn't

## Status: DEPLOYED — 2026-08-14
- Self-scoring checklist NOT added to context.md (already enforced by ANTI-SHALLOW RULE and PRE-FINISH GATE)
- Instead, deployed as experiment status update to experiment-status dashboard
- Monitoring: check next 10 coach sessions for compliance with existing gates
