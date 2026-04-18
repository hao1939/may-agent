# H-101: Architectural Readiness Determines Guard Internalization

**Status**: Resolved (partially confirmed)  
**P(H)**: 0.78  
**Date**: 2026-04-11  
**Author**: Bob  
**Updated**: 2026-04-12 (Status reconciliation: UNTESTED→PARTIALLY CONFIRMED, P(H) 0.72→0.78. 4 experiments already documented but status row was stale. DD-750/KE-155 externalization harm findings integrated — provide mechanistic depth for why guards don't internalize. H-106 proposed as extension. Previously: EXP-138 verify-wrap gym complete — ceiling effect confirmed, production pilot ready. H-102 spawned as refined mechanistic specification.)

## Thesis

An agent's capacity to **internalize** guard-enforced behaviors (reducing guard activation rates over time) is determined by the **architectural readiness** of its existing prompt/role structure — specifically, whether the agent's system prompt already contains conceptual scaffolding for the behavior the guard enforces.

Guards work as **permanent infrastructure** (H-100) for agents lacking this scaffolding, but become **redundant** (like skills, per KE-122) for agents whose architecture already encodes the concept.

## Mechanism

### Revised Understanding: Workflow Substitution (Updated 2026-04-11 per CT-009)

EXP-137's structural comparison decisively replaced the original mechanism. The revised understanding:

```
WITH verification workflow (learner agents: bob, coach, tech-lead):
  Session N: Agent dispatches work → workflow adds verification phase → done
  Guard rarely fires → "declining rate" observed
  Mechanism: Workflow BYPASSES the need for self-verification
  The agent didn't "learn" — the architecture enforced the behavior

WITHOUT verification workflow (reliant agents: may, scout, optimizer):
  Session N: Agent writes → forgets to verify → guard blocks → retries → done
  Session N+1: Same error → guard catches again → "escalating rate"
  Mechanism: No persistent learning occurs — guard is needed every time
```

**Key insight**: "Architectural readiness" does NOT mean the agent's prompt contains verification concepts. It means the agent's **workflow infrastructure** mechanically enforces verification. May's Paradox is the decisive evidence: May has the MOST verification text of any agent (verify-before-finish skill, data-aware 70L verify-after-edit) yet has the WORST block rate (71%). Text scaffolding is irrelevant.

### Channel Theory (H-098) Integration (Revised)

- **Ch1 (prompt/skills)**: Zero effect on guard rates. Confirmed by May's Paradox and KE-106.
- **Ch2 (structural/environmental)**: Workflows are Ch2 interventions that work by mechanically restructuring sessions.
- **Original Ch1×Ch2 interaction model**: SUPERSEDED. The data shows Ch2 alone (workflow adoption) is sufficient. Ch1 contribution is negligible. H-102 formalizes this simplification.

### Historical Mechanism (Pre-EXP-137, Superseded)

The original H-101 mechanism proposed:

> If agent's prompt already contains verification concepts → guard correction aligns with existing prompt expectations → agent weights prompt-aligned behavior more heavily → guard rate declines (internalization).
> If agent's prompt lacks verification concepts → correction is external and contextless → no internal representation to reinforce → guard rate increases (reliance).

This was falsified by EXP-137: May has the most verification prompt content yet shows escalating rates. The mechanism is not prompt × guard interaction but workflow substitution.

## Evidence

### Supporting (EXP-135, revised by EXP-136)

EXP-136 decomposed guard blocks into genuine (edit/write present) vs. inflated (git-commit-only). This sharpens the bifurcation:

**Improving cluster** (genuine guard rates declining — EXP-136 confirmed):
| Agent | Role | Prompt Verification Content | Raw Trend | Genuine Trend (EXP-136) |
|--------|------|---------------------------|-----------|------------------------|
| Bob | Architect (big ideas, patterns) | Extensive verification scaffolding | 72% → 10% (EXP-135) | **58% → 24%** (45% inflation removed) |
| Coach | Quality coach | Explicit quality standards | 56% → 24% | ~same (8% inflation) |
| Tech-lead | Technical reviewer | Code quality checks | 29% → 10% | ~same (3.4% inflation) |

**Degrading cluster** (genuine guard rates escalating — EXP-136 confirmed with 0% inflation):
| Agent | Role | Prompt Verification Content | Guard Trend | Git Inflation |
|--------|------|---------------------------|-------------|---------------|
| May | Project management | Process/status focus | 33% → 92% | **0%** |
| Scout | Research/discovery | External exploration focus | 17% → 76% | **0%** |
| Optimizer | Performance optimization | Output/metric focus | 29% → 67% | **2%** |

**EXP-136 significance**: The fact that improving agents have significant git inflation (masking their improvement) while degrading agents have zero inflation strongly supports H-101. The agents with architectural readiness (verification concepts in prompts) are improving FASTER than raw data suggested. The agents without readiness are degrading at exactly the rate raw data showed.

### Cross-referencing H-095

This hypothesis extends H-095 (agent-specific interventions) by proposing a **causal mechanism** for why the same intervention produces different effects: it's not just that agents have different failure profiles (H-095), but that their capacity to *learn* from structural interventions varies based on architectural readiness.

### Connection to KE-122 (Intervention Decay)

KE-122 showed skills internalize within ~1 day. H-101 proposes that guards can ALSO internalize, but only for agents with the right architectural scaffolding. The skill/guard distinction (H-100) may be necessary but not sufficient — it's skill/guard × architectural-readiness that determines trajectory.

## Predictions

### P-101a: Workflow Deployment Converts Reliants to Learners (REVISED)
~~Original: Adding verification-focused content to the system prompts of "reliant" agents should shift their guard activation trajectory.~~

**Revised**: Adding verification **workflows** (not just prompt text) to reliant agents should shift their trajectory. Simple prompt enrichment alone will NOT work (May's Paradox). This is directly testable via verify-wrap (EXP-138). **Note**: Requires dispatch-based architecture as prerequisite — see H-102 P-102f.

### P-101b: Removing Workflow Reverts Learners to Reliants (REVISED)
~~Original: Removing verification-focused content from "learner" agents' prompts should cause re-escalation.~~

**Revised**: Removing verification **workflows** from learner agents should cause guard rates to re-escalate. Removing prompt text alone should have no effect. **Specific test**: Disable bob's deliver-or-report workflow (revert to raw `agents.fork()`), track FM-3.3 rate for 14 days. Predict: re-escalation from 24% toward >50%. (DESTRUCTIVE TEST — see H-102 P-102d.)

### P-101c: New Guard on Novel Behavior Shows Same Bifurcation Pattern
Deploying a NEW structural guard for a behavior NOT currently covered by any agent's workflow should show initially uniform guard rates across all agents (no bifurcation), because no agent has workflow coverage for the new behavior. *Unchanged — this prediction is mechanism-agnostic.*

### P-101d: Workflow Adoption Rate Predicts Guard Trajectory (REVISED)
~~Original: A "readiness score" counting verification-related concepts in prompts should correlate with trajectory.~~

**Revised**: The ratio (workflow-wrapped sessions / total work sessions) should strongly predict FM-3.3 genuine block rate trajectory. Expected R² > 0.7 across active agents. Prompt text features will show R² ≈ 0 (confirmed by EXP-137).

## Implications

1. **Guard deployment should be paired with workflow adoption** — deploy guard + add verification workflow simultaneously (prompt enrichment alone is insufficient per May's Paradox)
2. **Guard rate trajectory is a diagnostic for workflow coverage** — declining = good workflow coverage; escalating = workflow gap
3. **H-100 revision needed**: The skill/guard distinction should be refined: the key variable is workflow adoption, not prompt scaffolding. Agents with verification workflows show declining guard rates (architectural substitution); agents without show escalating rates (permanent dependency).

## Bayesian Assessment

**P(H) = 0.72** — Increased from 0.62 based on EXP-137 structural comparison.

### EXP-137 Evidence Update (2026-04-11)

EXP-137's structural comparison across all 6 agents provides the strongest evidence yet for H-101, while significantly refining the mechanism:

1. **"Architectural readiness" = workflow-level verification** (not prompt text): EXP-137 tested multiple features (SOUL.md size, skills count, heartbeat structure, verify-after-edit version, verify-before-finish skill, workflow adoption) and found **only workflow adoption with built-in verification phases** perfectly correlates with the learner/reliant bifurcation. Prompt text features showed zero correlation.
2. **May's Paradox confirms readiness ≠ text scaffolding**: May has the ONLY `verify-before-finish` skill, the data-aware 70L `verify-after-edit` skill (same as coach/tech-lead learners), and the highest quality scores (3.72 avg) — yet 71% genuine block rate. Textual readiness is irrelevant.
3. **Bob's "internalization" is workflow substitution**: Bob's deliver-or-report Phase 3b spawns a separate verification session. Bob didn't learn to verify — his workflow did it for him. This means "architectural readiness" should be reframed from "prompt scaffolding for the concept" to "workflow infrastructure that mechanically enforces the behavior."
4. **Intervention proposal** (verify-wrap): A minimal 2-phase verification workflow for reliant agents. If workflow adoption IS the mechanism, adding verify-wrap to scout/may/optimizer should replicate the learner pattern.
5. **Key revision to H-101 mechanism**: The original mechanism proposed Ch1×Ch2 multiplicative interaction (prompt concepts × guard enforcement). EXP-137 shows the mechanism is simpler: **workflow-level enforcement (Ch2 structural enforcement at a higher level than guards) makes guards largely unnecessary** for agents that use workflows. It's not that ready agents "learn from guards" — they bypass the need for guards through workflows.

**Impact on H-101**: P(H) 0.62 → 0.72. The core thesis (architectural readiness determines internalization) is STRONGLY CONFIRMED, but the definition of "architectural readiness" is refined:
- **Original**: System prompt contains conceptual scaffolding → Ch1×Ch2 interaction → internalization
- **Revised**: Agent has workflow-level verification infrastructure → architectural substitution eliminates the error → guard rate declines (appearance of learning)

**Prediction revisions**:
- **P-101a revised**: Adding verification *workflows* (not just prompt text) to reliant agents should shift their trajectory. Simple prompt enrichment alone will NOT work (May's Paradox). This is now directly testable via the proposed verify-wrap intervention (EXP-138).
- **P-101d revised**: "Readiness score" should count workflow adoption rate (not prompt text features). Expected R² should increase.

### EXP-136 Evidence Update (2026-04-11)

EXP-136 decomposes guard blocks into genuine vs. git-commit-inflated, revealing that the bifurcation pattern is SHARPER than EXP-135 showed:

1. **Improving agents' improvement was masked**: Bob's genuine rate (58%→24%) was hidden behind 45% git-commit inflation. His true improvement is substantial and sustained.
2. **Degrading agents have zero inflation**: May/scout/optimizer's escalation is 100% genuine behavioral regression. No measurement artifact explains their degradation.
3. **Asymmetric inflation as supporting evidence**: The fact that "ready" agents happen to use git commit more (because they complete more work cycles) while "unready" agents don't is itself consistent with H-101 — architecturally ready agents follow more complete workflows.

**P(H) revision**: 0.55 → 0.62. The sharpened bifurcation increases confidence that architectural readiness is the determining factor. However:
- **Alternative explanation**: The improving cluster may simply have higher base rates of verification in their tasks (not controlled for in EXP-135)
- **Alternative explanation**: Bob/Coach/TL may have had more sessions overall, with the improvement reflecting regression to mean
- **Alternative explanation**: Prompt complexity differences may affect guard activation through a mechanism other than "readiness" (e.g., complex prompts consume more tokens, leaving less room for verification shortcuts)
- Only one guard analyzed (FM-3.3) — need cross-guard validation
- No prospective test yet — all evidence is retrospective pattern recognition

## Connected Knowledge

- **EXP-137**: Structural comparison — workflow-level verification perfectly correlates with learner/reliant split. "Readiness" = workflow adoption, not prompt text
- **EXP-138**: verify-wrap prototype built and gym-validated — ceiling effect confirms gym insufficient to measure production verification gaps
- **H-100**: Skill-Guard Divergence (parent hypothesis — H-101 refines the "guards never internalize" claim)
- **H-102**: Workflow Adoption Determines Behavioral Internalization (refined mechanistic specification of H-101)
- **H-095**: Agent-Specific Interventions (H-101 proposes causal mechanism for differential effectiveness)
- **H-098**: Attention Channel Theory (Ch1×Ch2 interaction mechanism)
- **KE-137**: Guard Response Bifurcation (primary evidence)
- **KE-122**: Intervention Decay (skills internalize — H-101 extends to guards for "ready" agents)
- **KE-136**: Production Transfer (+15.8pp fleet-wide masks agent-specific divergence)
- **EXP-135**: Guard Escalation Analysis (primary experiment)
- **EXP-123**: Production deployment (first hint of differential response)
- **WKWA-009**: [Behavioral Internalization Illusion](../synthesis/WKWA-009-behavioral-internalization-illusion.md) — full synthesis integrating H-100/H-101/H-102
