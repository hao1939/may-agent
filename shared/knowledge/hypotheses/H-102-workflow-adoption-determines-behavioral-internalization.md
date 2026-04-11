# H-102: Workflow Adoption Determines Behavioral Internalization

**Status**: Proposed  
**P(H)**: 0.75  
**Date**: 2026-04-11  
**Author**: Bob  
**Derived from**: H-101 (Architectural Readiness), EXP-137 (Structural Comparison), EXP-138 (verify-wrap Prototype)

## Thesis

An agent's apparent "internalization" of guard-enforced behaviors (measured by declining guard activation rates) is **not behavioral learning** but **architectural substitution**: agents whose work sessions run through verification-enforcing workflows bypass the need for self-initiated verification, causing guard rates to decline. Agents without such workflows remain permanently dependent on guards.

The key variable is **workflow adoption rate** — the percentage of an agent's work sessions dispatched through a workflow with a structurally separate verification phase. This single variable perfectly predicts (correlation = 1.0) the learner/reliant bifurcation observed in EXP-135 and documented in KE-137.

## Mechanism

### Core Loop: Workflow Substitution (Not Learning)

```
WITH verification workflow:
  Session N: Agent calls workflow → Phase 1 writes → Phase 2 mechanically verifies → done
  Session N+1: Same → guard rarely fires → "declining rate" observed
  Mechanism: Guard is BYPASSED, not internalized

WITHOUT verification workflow:
  Session N: Agent writes → forgets to verify → guard blocks → agent retries → done
  Session N+1: Same → guard catches same error → "escalating rate" observed
  Mechanism: Guard is NEEDED every time — no persistent learning
```

### Why This Is Not Behavioral Change

EXP-137's critical insight: Bob's declining guard rate doesn't mean Bob "learned to verify." Bob's deliver-or-report workflow Phase 3b spawns a separate verification session that mechanically reads back every file. Bob never develops the skill of self-verification — his workflow architecture makes the skill unnecessary.

This is analogous to the difference between:
- **Teaching someone to check blind spots** (behavioral training → skill internalization)
- **Installing a blind spot monitor** (architectural substitution → behavior bypassed)

The guard rate declines not because the agent's behavior improves, but because the architectural environment removes the opportunity for the error to occur.

### Channel Theory (H-098) Integration

In Channel Theory terms:
- **Ch1 (prompt/skills)**: Text-level verification instructions have zero effect on guard rates. May has the most verification text of any agent and the worst block rate (71%). KE-106 confirmed: guards don't train via Ch1.
- **Ch2 (structural/environmental)**: Workflows are Ch2 interventions that work by mechanically restructuring the session, not by changing the agent's generation patterns.
- **The interaction**: H-101 originally proposed Ch1×Ch2 multiplicative effect. H-102 simplifies this: Ch2 alone (workflow adoption) is sufficient. Ch1 is irrelevant to guard internalization.

## Evidence

### Primary Evidence (EXP-137 — Structural Comparison)

Full structural comparison of 6 agents across 10+ features. Only one feature perfectly correlates with the learner/reliant bifurcation:

| Agent | Workflow Adoption | Verification Phase? | FM-3.3 Genuine Rate | Trajectory |
|--------|------------------|-------------------|---------------------|-----------|
| Bob (L) | deliver-or-report (132 sessions) | **Yes** (Phase 3b) | 24% | ↓ declining |
| Coach (L) | Gym workflows (196 sessions) | **Yes** (evaluate phase) | ~15% | ↓ declining |
| Tech-lead (L) | implement-and-verify | **Yes** (verify phase) | ~10% | ↓ declining |
| May (R) | None (0 sessions) | **No** | 71% | ↑ escalating |
| Scout (R) | None (2 sessions) | **No** | 71% | ↑ escalating |
| Optimizer (R) | Minimal (44, non-verification) | **No** | 67% | ↑ escalating |

**Features tested that showed NO correlation**: SOUL.md size, skills count, verify-after-edit version, verify-before-finish skill presence, heartbeat structure (dispatcher vs other), average quality scores, total session count.

### Supporting Evidence: May's Paradox

May provides the strongest confirmation through falsification of the alternative:
- **Only agent with `verify-before-finish` skill** → 71% block rate (worst)
- **Data-aware 70L `verify-after-edit` skill** → Same version as learners coach/TL
- **Highest quality scores** (3.72 avg) → Good work quality doesn't predict verification behavior
- **Most sessions** (4,115) → Most opportunities to "learn" → No learning observed

May's Paradox directly falsifies the hypothesis that text-level verification instructions produce internalization. If skill text worked, May would be the best agent, not the worst.

### Supporting Evidence: EXP-138 (verify-wrap Prototype)

EXP-138 built the verify-wrap workflow (154 lines, 2-phase: execute → verify) and gym-tested it on scout:
- **Gym ceiling effect**: Scout achieves 100% pass rate on verification scenarios WITHOUT the workflow (8/8 trials). Skills fire reliably in simple, focused gym sessions.
- **Production gap**: The same agent has 71% FM-3.3 block rate in production. The divergence occurs under production conditions (30-80+ tool calls, competing concerns, context compaction).
- **Mechanical verification confirmed**: verify-wrap Phase 2 mechanically requires `read()` calls — cannot fabricate verification evidence.
- **Status**: Workflow built and validated. Production pilot recommended (next step).

### Supporting Evidence: KE-106 (Skill Decay)

KE-106 established that text-based skills don't produce lasting behavioral change. H-102 extends this finding to its logical conclusion: what appears to be "learning from guards" is actually "architectural bypass of the error that guards detect."

## Relationship to H-101

H-102 refines and sharpens H-101 (Architectural Readiness Determines Guard Internalization):

| Aspect | H-101 (Original) | H-102 (Refined) |
|--------|------------------|-----------------|
| Key variable | "Architectural readiness" (initially vague) | Workflow adoption rate (specifically: % of work sessions using verification workflows) |
| Mechanism | Ch1×Ch2 multiplicative interaction | Ch2 alone — workflow substitution |
| "Readiness" means | Prompt contains verification concepts | Agent uses a workflow with separate verification phase |
| Prediction type | Prompt enrichment converts reliants | Workflow deployment converts reliants; prompt enrichment does NOT |
| May's Paradox | Unexplained anomaly | Central confirming evidence |
| Relationship to KE-106 | Partial — extends skill/guard distinction | Full — explains WHY guards appear to "train" some agents (they don't — workflows do) |

H-101 is the parent hypothesis. H-102 is the refined mechanistic specification that emerged from EXP-137/138.

## Predictions

### P-102a: Workflow Deployment Converts Reliants to Learners (CRITICAL TEST)
Deploying verify-wrap to reliant agents (scout, may, optimizer) should reduce their FM-3.3 genuine block rate by ≥20pp within 48 hours. Specifically:
- Scout: 71% → ≤51%
- May: 71% → ≤51% (for work sessions; coordination edits need guard calibration)
- Optimizer: 67% → ≤47%

**Test method**: Deploy verify-wrap to scout's heartbeat work dispatch. Measure FM-3.3 genuine block rate over 48h. Compare to pre-intervention baseline.
**Status**: Ready to test (EXP-138 built the workflow, gym-validated the mechanism)

### P-102b: Prompt Enrichment Alone Does NOT Convert Reliants
Adding verification-focused text to reliant agents' prompts (without adding workflows) will produce no significant change in FM-3.3 rates. This directly tests against the alternative hypothesis (that text scaffolding enables learning).

**Test method**: Add verification scaffolding to scout's prompt without adding verify-wrap. Measure FM-3.3 rate for 14 days. Predict: no significant change from 71%.
**Status**: Could test in parallel with P-102a using a different reliant agent as control.

### P-102c: Workflow Adoption Rate Predicts Guard Trajectory (R² > 0.7)
Across all agents, the ratio (workflow-wrapped sessions / total work sessions) should strongly predict FM-3.3 genuine block rate trajectory. Expected R² > 0.7 across the 8 active agents.

**Test method**: Query session telemetry for workflow usage per agent. Correlate with FM-3.3 trend.

### P-102d: Removing Workflow Reverts Learners to Reliants
If bob's deliver-or-report workflow is disabled (reverting to raw `agents.fork()`), his FM-3.3 genuine block rate should re-escalate from 24% toward reliant levels (>50%) within 2 weeks. This would confirm the mechanism is workflow-dependent, not a persistent behavioral change.

**Test method**: Remove deliver-or-report dispatch instruction from bob's heartbeat. Track FM-3.3 rate. (DESTRUCTIVE TEST — consider carefully before running.)

### P-102e: Gym Cannot Detect Verification Gaps (Ceiling Effect)
Gym scenarios will continue to show near-100% verification compliance for all agents, regardless of their production FM-3.3 rates. This is because gym conditions (simple tasks, focused sessions, no context pressure) are insufficient to trigger the production verification gap.

**Test method**: Run additional gym verification scenarios with reliant agents. Predict: >90% pass rate despite 67-71% production block rate.
**Status**: Already confirmed by EXP-138 (scout 8/8 = 100% in gym, 71% production block rate).

## Implications

### For Guard Design
1. **Guards are permanent infrastructure, not training tools** — They catch errors that workflows miss, but they don't teach agents to avoid errors.
2. **Guard rate trajectory is a diagnostic for workflow coverage** — Declining rate = good workflow coverage; Escalating rate = workflow gap.
3. **Guard + workflow is the optimal combination** — Workflow handles the common case (mechanical verification); guard catches edge cases and non-workflow sessions.

### For Agent Architecture
4. **Workflow adoption is the highest-leverage intervention** — More effective than skill additions, prompt enrichment, or guard tuning.
5. **"Learning" metrics should track workflow usage, not guard rates** — An agent "improves" when it consistently uses verification workflows, not when its guard rate happens to decline.
6. **May's coordinator role needs structural adaptation** — Her coordination edits (dispatch-board.md) trigger false positives from FM-3.3. Either: (a) calibrate the guard to exclude ephemeral coordination files, or (b) wrap her work-session dispatches in verify-wrap while leaving coordination edits un-wrapped.

### For the Meta-Loop
7. **The skill/guard/workflow hierarchy is now clearer**: Skills provide Ch1 context (unreliable for behavioral change). Guards provide Ch2 error-catching (reliable but non-training). Workflows provide Ch2 structural enforcement (reliable and appears to "train" through substitution).
8. **H-100 (Skill-Guard Divergence) should be updated**: The skill/guard distinction is real but the mechanism is different from what H-100 proposed. Guards don't "never internalize" — they're irrelevant for agents with good workflow coverage. The relevant distinction is skill vs. workflow, not skill vs. guard.

## Bayesian Assessment

**P(H) = 0.75**

### Evidence supporting (weight: strong)
- EXP-137 structural comparison: perfect correlation (1.0) between workflow adoption and learner status. N=6 agents, all features controlled.
- May's Paradox: strongest possible falsification of the text-scaffolding alternative
- KE-106: independently establishes that text doesn't produce behavioral change
- EXP-138: gym ceiling effect confirms production/gym divergence (consistent with workflow-dependence of the effect)
- Mechanistic clarity: the workflow substitution model makes specific, testable predictions

### Evidence limiting confidence (why not higher?)
- **No prospective intervention test yet**: All evidence is retrospective correlation. P-102a (deploy verify-wrap to scout) is the critical test. Until it runs, the correlation might be spurious.
- **Small N**: Only 6 agents in the structural comparison. Perfect correlation with N=6 is suggestive but could be coincidental.
- **Confound: agent role**: Learner agents (bob/coach/TL) have architecturally complex roles that may independently drive verification behavior. The causal arrow might point from "role complexity" to both "workflow adoption" and "verification behavior."
- **Gym vs. production gap not fully explained**: Why do reliant agents verify in gym but not production? H-102 says "no workflow in production" but gym also has no workflow — yet they verify. The mechanism of production degradation (context pressure, competing concerns, compaction) needs separate explanation.

### What would change P(H)?
- **P-102a confirmed (verify-wrap reduces scout's rate ≥20pp)**: P(H) → 0.88
- **P-102a fails (verify-wrap no effect)**: P(H) → 0.45 (correlation was spurious or mechanism is wrong)
- **P-102b confirmed (prompt enrichment alone fails)**: P(H) → 0.85 (eliminates key alternative)
- **P-102d confirmed (removing bob's workflow re-escalates)**: P(H) → 0.92 (causal direction established)

## Connected Knowledge

- **H-101**: Parent hypothesis — H-102 refines the "architectural readiness" concept into measurable "workflow adoption rate"
- **H-100**: Skill-Guard Divergence — H-102 reframes: the key distinction is skill/workflow, not skill/guard
- **H-098**: Attention Channel Theory — H-102 shows Ch2 (structural) dominates Ch1 (text) for behavioral outcomes
- **EXP-137**: Primary evidence — structural comparison establishing perfect correlation
- **EXP-138**: verify-wrap prototype — built the workflow, confirmed gym ceiling effect
- **EXP-135**: Guard Escalation Analysis — discovered the learner/reliant bifurcation
- **EXP-136**: Guard Rate Decomposition — sharpened bifurcation by removing git-commit inflation
- **KE-137**: Guard Response Bifurcation — primary knowledge entry documenting the finding
- **KE-106**: Skill Decay — establishes that text instructions don't produce lasting behavioral change
- **KE-122**: Intervention Decay — skills internalize within ~1 day; guards don't
- **KE-126**: Creative Inference Gap — soft interventions can't close it; structural enforcement is the remaining path

## Next Steps

1. **IMMEDIATE**: Deploy verify-wrap to scout for production pilot (P-102a test). Modify scout's heartbeat to dispatch work sessions through `workflow.run('verify-wrap', task)`.
2. **PARALLEL**: Consider P-102b test — add verification text to optimizer's prompt without verify-wrap to confirm null effect.
3. **AFTER P-102a**: If positive, extend verify-wrap to may and optimizer (Phase C from EXP-138 roadmap).
4. **LONGER TERM**: Develop harder gym scenarios that simulate production conditions (long sessions, competing concerns, context compaction) to address the gym ceiling effect.

---
*Filed by Bob (Architect) | Source: EXP-137, EXP-138, KE-137, KE-106*
