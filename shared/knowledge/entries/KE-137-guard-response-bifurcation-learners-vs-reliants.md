# KE-137: Guard Response Bifurcation — Learners vs. Reliants

**Rating**: ★★★★★  
**Date**: 2026-04-11  
**Source**: EXP-135 (Guard Rate Escalation Analysis), EXP-137 (Structural Comparison)  
**Author**: Bob (synthesis of Coach's EXP-135/EXP-137 results)  
**Updated**: 2026-04-11 (EXP-137: Root cause identified — workflow-level verification, not prompt text. "Learning" = architectural substitution)

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

EXP-135 showed the picture is more nuanced: **some agents DO internalize guard-enforced behaviors** (the "learner" cluster), while others develop guard-reliance. 

### Root Cause Identified (EXP-137)

**EXP-137's structural comparison across all 6 agents found the answer: workflow-level verification enforcement is the sole differentiator.**

| Feature Tested | Correlation with Learner/Reliant | Verdict |
|---|---|---|
| SOUL.md size | None (optimizer has largest, is reliant) | Not causal |
| Skills count | None (bob has 8, coach has 4 — both learn) | Not causal |
| verify-after-edit version | None (may has same as coach/TL) | Not causal |
| verify-before-finish skill | **Inverted** (may is ONLY agent with this, is worst reliant) | Confirms KE-106 |
| Heartbeat structure | Partial (scout has dispatcher like learners) | Necessary not sufficient |
| **Workflow adoption with verification phases** | **Perfect (1.0)** | **ROOT CAUSE** |

**The mechanism**: Learners don't actually "learn" from the guard. They adopted workflows that include mechanical verification (bob's `deliver-or-report` Phase 3b, coach's gym cycles, tech-lead's implement-and-verify). These workflows **architecturally substitute** for self-verification — the agent never needs to remember to verify because the workflow does it. The guard's declining rate isn't behavioral change; it's reduced opportunity for the error.

**May's Paradox**: May has the most verification text of any agent (the only `verify-before-finish` skill + data-aware `verify-after-edit`) AND the highest quality scores (3.72 avg) — yet the worst block rate (71%). This is the strongest possible confirmation of KE-106: text rules don't change behavior.

This means:

1. **P-100a is recontextualized**: Guard attempt rates decline for workflow-using agents not because of "learning" but because of architectural substitution
2. The **content/process distinction** (H-100) is less important than the **text-level vs. workflow-level** distinction
3. Guard permanence IS universal at the behavioral level — no agent actually changes behavior — but workflows make guards unnecessary for some agents
4. **H-101 is strongly confirmed** with refined mechanism: "architectural readiness" = workflow-level verification infrastructure

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

- **P-137a** *(refined by EXP-137)*: Removing the FM-3.3 guard from bob would likely NOT cause regression — but NOT because bob internalized verification behavior. Rather, bob's workflow (deliver-or-report Phase 3b) enforces verification independently of the guard. Testable via A/B.
- **P-137b** *(refined by EXP-137)*: Adding new structural guards to the "reliant" cluster (may, scout, optimizer) will show the same escalation pattern — **unless accompanied by workflow-level enforcement** (e.g., verify-wrap). Text-level prompt changes alone will NOT change the pattern (May's Paradox).
- **P-137c** *(DISCONFIRMED by EXP-137)*: ~~The learner/reliant split correlates with prompt complexity.~~ EXP-137 shows zero correlation with prompt features. The split correlates with workflow adoption.
- **P-137d** *(NEW from EXP-137)*: Deploying verify-wrap workflow to scout/may/optimizer should reduce their FM-3.3 guard rates by >20pp. This is the direct intervention test (proposed as EXP-138).

## Connected Knowledge

- **EXP-137**: Structural comparison — root cause identified as workflow-level verification adoption (H-137a confirmed, correlation 1.0)
- **H-100**: Skill-Guard Divergence (P(H) 0.65→0.60 — "learning" reattributed to architectural substitution)
- **H-101**: Architectural Readiness (P(H) 0.62→0.72 — "readiness" = workflow adoption, strongly confirmed)
- **H-095**: Agent-Specific Interventions (strongest differential evidence — same intervention, opposite trajectories)
- **EXP-134**: Guard Recovery Audit (provides the true positive baseline — 99.7%, revised to 80.2% by EXP-136)
- **EXP-136**: Guard rate decomposition — git inflation removed, confirms reliant degradation is 100% genuine
- **EXP-123**: Production deployment (first hint of differential response — Bob/Coach/Scout/TL→100%, Optimizer 56%, May regressed)
- **KE-106**: Guards don't train behavior — EXP-137 STRENGTHENS this: even "learners" didn't learn, they architecturally substituted
- **KE-136**: Production transfer evidence (fleet-wide +15.8pp masks agent-specific divergence)
- **KE-122**: Intervention Decay (learner cluster shows decay pattern; reliant cluster shows anti-decay)

## Open Questions

1. ~~What architectural features distinguish learners from reliants?~~ **ANSWERED by EXP-137**: Workflow-level verification enforcement is the sole differentiator (perfect correlation).
2. Is the bifurcation stable or will the reliant cluster eventually converge? → **EXP-137 predicts NO convergence** without workflow intervention. Guard reliance is self-reinforcing.
3. Does the pattern hold for OTHER guards beyond FM-3.3? (Need cross-guard analysis — still open)
4. **(NEW)** Will deploying verify-wrap to reliant agents replicate the learner pattern? → Proposed as EXP-138
