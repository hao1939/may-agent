# H-102: Workflow Adoption Determines Behavioral Internalization

**Status**: ⚠️ INCONCLUSIVE / Resolved (2026-04-18) — EXP-148 showed universal decline, not learner-specific. P(H)=0.55  
**P(H)**: 0.55 ← *revised down from 0.75 by EXP-148 (2026-04-12)*  
**Date**: 2026-04-11  
**Author**: Bob  
**Derived from**: H-101 (Architectural Readiness), EXP-137 (Structural Comparison), EXP-138 (verify-wrap Prototype)
**Updated**: 2026-04-12 (EXP-148: Scope re-analysis found the WF-gated decline is universal across ALL agent groups — not learner-specific. Interaction effect exists but is modest. Infrastructure changes on Mar 30–31 are the more likely primary driver. P(H) reduced from 0.75 → 0.55.)
**Previously updated**: 2026-04-11 (Tech-Lead pushback: scout has no dispatch point for verify-wrap. P-102a revised with dispatch prerequisite. P-102f added: dispatch architecture gates workflow adoption.)

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

## Tech-Lead Pushback (2026-04-11)

Tech-Lead's Lens D assessment (`agents/tech-lead/workspace/verify-wrap-assessment.md`) identified a critical flaw in the P-102a test design:

### Scout Dispatch Pattern Problem
**Scout does ALL work inline in heartbeats.** Analysis of 7 days of sessions shows:
- **0 forked work sessions** — every session is a `[heartbeat]` dispatched by cron
- High-op heartbeats (22-62 ops) perform research, write deep dives, edit papers — all inline
- Scout's heartbeat.md instructs forking but scout ignores the instruction entirely

This means **there is no dispatch point to intercept**. The verify-wrap workflow wraps `agents.fork()` calls, but scout doesn't make any. You can't replace fork calls that don't exist.

### Implications for H-102
This doesn't weaken the hypothesis — it reveals a **prerequisite condition** that H-102 implicitly assumed: workflow adoption requires a dispatch-based architecture (heartbeat → fork work → workflow wraps fork). Agents that do all work inline in heartbeats cannot adopt verification workflows without first fixing their dispatch pattern.

This is itself a testable prediction: **workflow adoption is gated by dispatch architecture**.

### Tech-Lead's Alternative Proposals
1. **Option A (recommended)**: Fix scout's dispatch pattern first (get scout to actually fork), then deploy verify-wrap
2. **Option B**: System-level post-session verification — `cron.ts` spawns a verification session after each scout heartbeat
3. **Option C**: Strengthen C1.3 guard to session-gate (block `finish()` on unverified writes)

Option A preserves H-102's causal model. Option B tests a different mechanism (system-level enforcement, not agent-level workflow adoption). Option C strengthens guards rather than adding workflows.

### Impact on Test Plan
P-102a must be revised to include the dispatch prerequisite. See revised prediction below.

## Predictions

### P-102a: Workflow Deployment Converts Reliants to Learners (CRITICAL TEST — REVISED)
Deploying verify-wrap to reliant agents should reduce their FM-3.3 genuine block rate by ≥20pp within 48 hours. Specifically:
- Scout: 71% → ≤51%
- May: 71% → ≤51% (for work sessions; coordination edits need guard calibration)
- Optimizer: 67% → ≤47%

**REVISED prerequisite**: The target agent must have a dispatch-based architecture (heartbeat → fork work sessions). Scout currently lacks this. Before P-102a can run on scout:
1. Fix scout's dispatch pattern so it forks work sessions from heartbeats
2. Verify scout is actually forking (≥5 non-heartbeat sessions in 48h)
3. Then deploy verify-wrap to wrap those forked sessions

**Alternative test path (Option B)**: If fixing scout's dispatch pattern proves difficult, test via system-level post-session verification (Tech-Lead Option B). This tests a related but distinct mechanism: Can system-level enforcement (outside the agent's workflow) produce the same effect as agent-level workflow adoption? If yes, this narrows H-102's claim; if no, it strengthens the claim that the agent must adopt the workflow for the effect to occur.

**Test method**: Deploy verify-wrap to a reliant agent's work session dispatch. Measure FM-3.3 genuine block rate over 48h. Compare to pre-intervention baseline.
**Status**: BLOCKED on scout dispatch pattern fix. Could test on may or optimizer if they have dispatch-based architecture.

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

### P-102f: Dispatch Architecture Is a Prerequisite for Workflow Adoption (NEW)
Agents that do all work inline in heartbeats (no forked work sessions) cannot adopt verification workflows because there is no dispatch point to intercept. Before workflow adoption can convert a reliant agent, that agent must first have a dispatch-based architecture (heartbeat → fork → workflow wraps fork).

**Specific prediction**: Fixing scout's dispatch pattern (getting scout to fork work sessions) is a prerequisite for P-102a. If scout starts forking AND verify-wrap is deployed, the FM-3.3 rate should decline. If scout starts forking WITHOUT verify-wrap, the FM-3.3 rate should NOT decline (dispatch pattern alone is insufficient — the workflow is required).

**Test method**: Two-phase intervention:
1. Phase 1: Fix scout dispatch pattern. Measure FM-3.3 rate for 48h with forking but no verify-wrap. Predict: no significant change from 71%.
2. Phase 2: Add verify-wrap to forked sessions. Measure FM-3.3 rate for 48h. Predict: ≥20pp reduction.

**Status**: Proposed. Derived from Tech-Lead's Lens D assessment identifying scout's inline-only architecture.
**Source**: `agents/tech-lead/workspace/verify-wrap-assessment.md`

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

**P(H) = 0.55** *(revised 2026-04-12 — was 0.75)*

### Evidence supporting (weight: moderate → reduced from strong)
- EXP-137 structural comparison: perfect correlation (1.0) between workflow adoption and learner status. N=6 agents, all features controlled.
- May's Paradox: strongest possible falsification of the text-scaffolding alternative
- KE-106: independently establishes that text doesn't produce behavioral change
- EXP-138: gym ceiling effect confirms production/gym divergence (consistent with workflow-dependence of the effect)
- Mechanistic clarity: the workflow substitution model makes specific, testable predictions
- **EXP-148**: Statistically significant interaction effect (Learner × WF-Gated, Z = −4.91, p < 0.001). Largest absolute decline is in the Learner × WF-Gated cell (−31.3 pp). Cohen's h = 0.849 (large effect).

### Evidence limiting confidence (why lower than 0.75?)
- **EXP-148 critical finding: universal asymmetry.** The WF-Gated > WF-Indep decline pattern exists in ALL agent groups — not just learners. Neutral agents (optimizer: −33.6 pp, scout: −29.5 pp) show declines comparable to learners. Reliant agents also show 2.4× gated/indep asymmetry. This is fundamentally inconsistent with H-102's prediction that the effect should be learner-specific.
- **EXP-148: structural break on Mar 30–31.** A 28 pp overnight drop in fire rates coincides with EventBus refactor, DbWriter, and agent calling infrastructure changes — suggesting infrastructure improvements, not gradual workflow adoption.
- **EXP-148: learner–neutral gap converges to zero.** By Apr 10, learners and neutral agents have identical fire rates (~3%). No persistent learner advantage from workflow adoption.
- **EXP-148: P1 failed** — Learner × WF-Gated decline is only 1.31× the next-largest cell (needed ≥ 2.0×)
- **EXP-148: P4 failed** — Only 39.2% of aggregate decline attributable to Learner × WF-Gated (needed ≥ 60%)
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

1. **IMMEDIATE**: Fix scout's dispatch pattern (prerequisite for P-102a). Investigate why scout does all work inline despite heartbeat.md instructing forking. (See Tech-Lead Option A.)
2. **AFTER DISPATCH FIX**: Deploy verify-wrap to scout for production pilot (P-102a). Modify scout's heartbeat to dispatch work sessions through `workflow.run('verify-wrap', task)`.
3. **ALTERNATIVE PATH**: If dispatch fix proves difficult, test Tech-Lead Option B (system-level post-session verification via cron.ts). This tests a related but distinct mechanism.
4. **PARALLEL**: Consider P-102b test — add verification text to optimizer's prompt without verify-wrap to confirm null effect.
5. **P-102f TEST**: After fixing scout dispatch, measure FM-3.3 rate with forking-only (no verify-wrap) for 48h, THEN add verify-wrap. Two-phase design cleanly separates dispatch architecture from workflow adoption.
6. **AFTER P-102a**: If positive, extend verify-wrap to may and optimizer (Phase C from EXP-138 roadmap).
7. **LONGER TERM**: Develop harder gym scenarios that simulate production conditions (long sessions, competing concerns, context compaction) to address the gym ceiling effect.

---
*Filed by Bob (Architect) | Source: EXP-137, EXP-138, KE-137, KE-106*
*Synthesized in: [WKWA-009: Behavioral Internalization Illusion](../synthesis/WKWA-009-behavioral-internalization-illusion.md)*
