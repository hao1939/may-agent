# H-101: Architectural Readiness Determines Guard Internalization

**Status**: Proposed  
**P(H)**: 0.55  
**Date**: 2026-04-11  
**Author**: Bob  
**Updated**: 2026-04-11 (Created based on EXP-135 bifurcated response finding)

## Thesis

An agent's capacity to **internalize** guard-enforced behaviors (reducing guard activation rates over time) is determined by the **architectural readiness** of its existing prompt/role structure — specifically, whether the agent's system prompt already contains conceptual scaffolding for the behavior the guard enforces.

Guards work as **permanent infrastructure** (H-100) for agents lacking this scaffolding, but become **redundant** (like skills, per KE-122) for agents whose architecture already encodes the concept.

## Mechanism

1. **Guard fires** → agent's behavior is corrected
2. **If agent's prompt already contains verification concepts** → correction aligns with existing prompt expectations → agent weights prompt-aligned behavior more heavily in future → guard rate declines (internalization)
3. **If agent's prompt lacks verification concepts** → correction is external and contextless → agent has no internal representation to reinforce → guard rate increases (reliance)

In Channel Theory (H-098) terms: Guards create Ch2 environmental state. For "ready" agents, this Ch2 signal reinforces existing Ch1 concepts (multiplicative effect). For "unready" agents, the Ch2 signal exists in isolation (additive at best, reliance at worst).

## Evidence

### Supporting (EXP-135)

**Improving cluster** (guard rates declining):
| Agent | Role | Prompt Verification Content | Guard Trend |
|--------|------|---------------------------|-------------|
| Bob | Architect (big ideas, patterns) | Extensive verification scaffolding | 72% → 10% |
| Coach | Quality coach | Explicit quality standards | 56% → 24% |
| Tech-lead | Technical reviewer | Code quality checks | 29% → 10% |

**Degrading cluster** (guard rates escalating):
| Agent | Role | Prompt Verification Content | Guard Trend |
|--------|------|---------------------------|-------------|
| May | Project management | Process/status focus | 39% → 91% |
| Scout | Research/discovery | External exploration focus | 11% → 76% |
| Optimizer | Performance optimization | Output/metric focus | 17% → 52% |

### Cross-referencing H-095

This hypothesis extends H-095 (agent-specific interventions) by proposing a **causal mechanism** for why the same intervention produces different effects: it's not just that agents have different failure profiles (H-095), but that their capacity to *learn* from structural interventions varies based on architectural readiness.

### Connection to KE-122 (Intervention Decay)

KE-122 showed skills internalize within ~1 day. H-101 proposes that guards can ALSO internalize, but only for agents with the right architectural scaffolding. The skill/guard distinction (H-100) may be necessary but not sufficient — it's skill/guard × architectural-readiness that determines trajectory.

## Predictions

### P-101a: Prompt Enrichment Converts Reliants to Learners
Adding verification-focused content to the system prompts of "reliant" agents (may, scout, optimizer) should shift their guard activation trajectory from escalating to declining within 2 weeks. **Specific test**: Add verification scaffolding to May's prompt, track FM-3.3 guard rate for 14 days, compare to pre-intervention trajectory.

### P-101b: Removing Prompt Scaffolding Converts Learners to Reliants
Removing verification-focused content from "learner" agents' prompts (bob, coach, TL) should cause their guard rates to re-escalate, even though they previously showed declining rates. **Specific test**: Remove verification scaffolding from Bob's prompt, track FM-3.3 guard rate for 14 days.

### P-101c: New Guard on Novel Behavior Shows Same Bifurcation Pattern
Deploying a NEW structural guard for a behavior NOT currently scaffolded in ANY agent's prompt should show initially uniform guard rates across all agents (no bifurcation), because no agent has architectural readiness for the new behavior.

### P-101d: Architectural Readiness Score Predicts Guard Trajectory
A quantified "readiness score" (counting verification-related concepts in each agent's system prompt) should correlate with guard rate trajectory (R² > 0.5 across the 7 agents).

## Implications

1. **Guard deployment should be paired with prompt enrichment** — deploy guard + add conceptual scaffolding to prompt simultaneously
2. **Guard rate trajectory is a diagnostic** — declining = agent is learning; escalating = architectural gap
3. **H-100 revision needed**: The skill/guard distinction should be refined into a 2×2 matrix: skill × ready = fast internalization, skill × unready = slow internalization, guard × ready = eventual internalization (learner pattern), guard × unready = permanent dependency (reliant pattern)

## Bayesian Assessment

**P(H) = 0.55** — Moderate confidence. The bifurcation pattern (EXP-135) is robust and the agent clusters make intuitive sense. However:
- **Alternative explanation**: The improving cluster may simply have higher base rates of verification in their tasks (not controlled for in EXP-135)
- **Alternative explanation**: Bob/Coach/TL may have had more sessions overall, with the improvement reflecting regression to mean
- **Alternative explanation**: Prompt complexity differences may affect guard activation through a mechanism other than "readiness" (e.g., complex prompts consume more tokens, leaving less room for verification shortcuts)
- Only one guard analyzed (FM-3.3) — need cross-guard validation
- No prospective test yet — all evidence is retrospective pattern recognition

## Connected Knowledge

- **H-100**: Skill-Guard Divergence (parent hypothesis — H-101 refines the "guards never internalize" claim)
- **H-095**: Agent-Specific Interventions (H-101 proposes causal mechanism for differential effectiveness)
- **H-098**: Attention Channel Theory (Ch1×Ch2 interaction mechanism)
- **KE-137**: Guard Response Bifurcation (primary evidence)
- **KE-122**: Intervention Decay (skills internalize — H-101 extends to guards for "ready" agents)
- **KE-136**: Production Transfer (+15.8pp fleet-wide masks agent-specific divergence)
- **EXP-135**: Guard Escalation Analysis (primary experiment)
- **EXP-123**: Production deployment (first hint of differential response)
