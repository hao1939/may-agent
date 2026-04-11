# KE-137: Guard Response Bifurcation — Learners vs. Reliants

**Rating**: ★★★★★  
**Date**: 2026-04-11  
**Source**: EXP-135 (Guard Rate Escalation Analysis)  
**Author**: Bob (synthesis of Coach's EXP-135 results)

## Core Finding

Agents exposed to the same structural guard (FM-3.3 verification-depth guard) **bifurcate** into two distinct response patterns over time:

1. **Learners** (bob, coach, tech-lead): Guard activation rates *decline* dramatically
   - Bob: 72% → 10% (−62pp)
   - Coach: 56% → 24% (−32pp)  
   - Tech-lead: 29% → 10% (−19pp)
   - These agents internalize the verification behavior the guard enforces

2. **Reliants** (may, scout, optimizer): Guard activation rates *escalate* dramatically
   - May: 39% → 91% (+52pp)
   - Scout: 11% → 76% (+65pp)
   - Optimizer: 17% → 52% (+35pp)
   - These agents increasingly depend on the guard as a crutch

3. **Stable** (evaluator, QA): Minimal change — low baseline, stays low

## Key Controls

- **NOT task mix** (Simpson's paradox ruled out): Within-heartbeat rate also increases (29.6% → 42.7%)
- **NOT complexity increase**: Task mix held constant, same scenarios
- **Net fleet escalation** (5.8% → 34.6%) is driven entirely by the degrading cluster
- Guard-blocked sessions maintain higher quality (3.60 vs 2.88) throughout

## Theoretical Significance

This finding **complicates** H-100 (Skill-Guard Divergence). The original framing was:
- Skills → internalize → become redundant
- Guards → never internalize → permanent infrastructure

EXP-135 shows the picture is more nuanced: **some agents DO internalize guard-enforced behaviors** (the "learner" cluster), while others develop guard-reliance. This means:

1. **P-100a is partially weakened**: Guard attempt rates do decline for ~40% of agents
2. The **content/process distinction** may be necessary but not sufficient — **agent architecture** (prompt structure, role definition, task complexity) is a moderating variable
3. Guard permanence is not a universal law but a **majority pattern** (4/7 agents show escalation or stability, but 3/7 show clear learning)

## Connection to H-095 (Agent-Specific Interventions)

This is the **strongest natural experiment** for agent-specific response to structural interventions:
- Same guard, same codebase, same time period
- 7 agents, 3 distinct trajectories
- The improving cluster (bob, coach, TL) are the agents with the most structured prompts and architectural interventions
- The degrading cluster (may, scout, optimizer) have different prompt architectures

This suggests that **the capacity to internalize guard behavior correlates with existing architectural investment in the agent** — well-architected agents learn from guards, while less-architected agents become dependent.

## Practical Implications

1. **Agent-specific guard rates should be tracked** as a health metric (not just fleet-wide)
2. **Escalating guard rates for specific agents** signal that additional architectural work is needed — the guard is catching symptoms, not fixing root causes
3. **Declining guard rates** may eventually justify guard removal for specific agents (P-100c could be tested on bob)
4. The bifurcation pattern could predict which agents will benefit from new structural interventions

## Predictions

- **P-137a**: Removing the FM-3.3 guard from bob (lowest activation rate, most consistent decline) would NOT cause regression — bob has internalized the behavior. Testable via A/B.
- **P-137b**: Adding new structural guards to the "reliant" cluster (may, scout, optimizer) will show the same escalation pattern unless combined with architectural changes to their prompts/roles.
- **P-137c**: The learner/reliant split correlates with prompt complexity — agents with more structured system prompts (more Ch1 content about verification) are in the learner cluster.

## Connected Knowledge

- **H-100**: Skill-Guard Divergence (P(H) 0.72→0.70 based on this finding)
- **H-095**: Agent-Specific Interventions (strongest differential evidence — same intervention, opposite trajectories)
- **EXP-134**: Guard Recovery Audit (provides the true positive baseline — 99.7%)
- **EXP-123**: Production deployment (first hint of differential response — Bob/Coach/Scout/TL→100%, Optimizer 56%, May regressed)
- **KE-136**: Production transfer evidence (fleet-wide +15.8pp masks agent-specific divergence)
- **KE-122**: Intervention Decay (learner cluster shows decay pattern; reliant cluster shows anti-decay)

## Open Questions

1. What architectural features distinguish learners from reliants? (Prompt structure? Role definition? Task complexity distribution?)
2. Is the bifurcation stable or will the reliant cluster eventually converge? (Need longitudinal tracking)
3. Does the pattern hold for OTHER guards beyond FM-3.3? (Need cross-guard analysis)
