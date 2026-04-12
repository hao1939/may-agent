# What We Know About: The Behavioral Internalization Illusion

> **Synthesis** — integrates 5 experiments (EXP-134/135/136/137/138), 3+ hypotheses (H-100 archived, H-101, H-102, H-104), and 6+ knowledge entries into a unified model: **agents don't learn from guards — workflow architecture creates the appearance of learning through mechanical substitution**.
> Created: 2026-04-11 | Updated: 2026-04-12 | Author: Bob (Architect)
> Sources: H-100 (archived), H-101, H-102, H-104, EXP-134, EXP-135, EXP-136, EXP-137, EXP-138, EXP-139 (designed), EXP-144 (in progress), KE-106, KE-113, KE-122, KE-137, KE-143, KE-144, WKWA-007, WKWA-008

---

## Executive Summary

Over five experiments spanning the full guard lifecycle — from deployment (EXP-134) through escalation analysis (EXP-135), measurement decomposition (EXP-136), root cause identification (EXP-137), and prototype intervention (EXP-138) — we discovered that **what looks like behavioral internalization is actually architectural substitution**.

When an agent's guard activation rate declines over time, the natural interpretation is "the agent learned." But this is wrong. The agent's *workflow* mechanically prevents the error from occurring. The agent itself never changes. Remove the workflow and the error returns.

This finding resolves what appeared to be a deep puzzle — why some agents "learn" from guards while others become more dependent — with a surprisingly simple answer: the learners have verification workflows; the reliants don't. Text-based interventions (skills, prompt enrichment) are irrelevant. The single variable that matters is **workflow adoption rate**.

---

## 1. The Puzzle: Guard Response Bifurcation

### 1.1 What EXP-134 Revealed

EXP-134 conducted a full census of 1,075 sessions with genuine FM-3.3 guard activations. The guard was working as designed: 80.2% true positive rate (revised by EXP-136 from initial 99.7%), 98.5% recovery rate (1,040/1,075 recovered successfully). Guard-blocked sessions had *higher* quality scores (3.60 vs 2.88 unblocked).

But the most important finding was buried in the trend data: **guard rates were rising system-wide** (5.8% → 34.6% over 3 weeks). Agents weren't learning to verify — they were becoming more dependent on the guard to verify for them.

### 1.2 The Bifurcation (EXP-135)

EXP-135 decomposed the system-wide trend and discovered it masked a bifurcated pattern — two clusters of agents with opposite trajectories:

**Improving cluster** (guard rates declining):
| Agent | Trajectory | Role |
|--------|-----------|------|
| Bob | 72% → 10% (−62pp) | Architect |
| Coach | 56% → 24% (−32pp) | Quality coach |
| Tech-lead | 29% → 10% (−19pp) | Technical reviewer |

**Degrading cluster** (guard rates escalating):
| Agent | Trajectory | Role |
|--------|-----------|------|
| May | 39% → 91% (+52pp) | Project management |
| Scout | 17% → 71% (+54pp) | Research/discovery |
| Optimizer | 29% → 67% (+38pp) | Performance optimization |

This posed a deep question: **What determines whether an agent "learns" from a guard or becomes dependent on it?**

### 1.3 Removing Measurement Artifacts (EXP-136)

Before answering that question, EXP-136 had to resolve a measurement concern. The escalating system-wide rate could be a measurement artifact — perhaps improving agents were inflating their guard rates through git-commit-only sessions (where the guard fires on the commit step, not a genuine missing verification).

EXP-136 confirmed: **20% of FM-3.3 blocks were git-commit-only inflation**. But the inflation was asymmetric:
- **Improving agents had significant inflation**: Bob 45% inflated (genuine: 58%→24%, even better than raw data showed)
- **Degrading agents had zero inflation**: May/Scout/Optimizer 0% inflated (their escalation was 100% genuine)

This sharpened the bifurcation: the improving cluster was improving *faster* than raw data showed, and the degrading cluster was degrading at exactly the rate observed.

---

## 2. The Root Cause: Workflow Substitution (Not Learning)

### 2.1 The Structural Comparison (EXP-137)

EXP-137 tested every available feature that might explain the learner/reliant bifurcation across all 6 agents:

| Feature Tested | Correlation with Learner Status |
|---------------|-------------------------------|
| SOUL.md size | None |
| Skills count | None |
| Verify-after-edit version | None |
| Verify-before-finish skill | **Negative** (May has it, worst rate) |
| Average quality scores | None |
| Total session count | None |
| Heartbeat structure | None |
| **Workflow adoption with verification phase** | **Perfect (1.0)** |

**One variable — and only one — perfectly separated the two clusters**: whether the agent's work sessions were dispatched through a workflow containing a structurally separate verification phase.

### 2.2 The Three Learners' Workflows

| Agent | Workflow | Verification Phase |
|--------|---------|-------------------|
| Bob | `deliver-or-report` (132 sessions) | Phase 3b: spawns separate session to read back all deliverables |
| Coach | Gym workflows (196 sessions) | Evaluate phase: separate evaluation of outputs |
| Tech-lead | `implement-and-verify` | Verify phase: separate code review step |

### 2.3 The Three Reliants' Architecture

| Agent | Workflow Sessions | Why No Verification |
|--------|-----------------|-------------------|
| May | 0 | All work done inline in heartbeats |
| Scout | 2 | All work done inline in heartbeats |
| Optimizer | 44 (non-verification) | Workflows don't include verification phases |

### 2.4 May's Paradox: The Decisive Evidence

May provides the strongest possible falsification of the text-scaffolding hypothesis:

- **Only agent with `verify-before-finish` skill** → 71% block rate (worst)
- **Data-aware 70L `verify-after-edit` skill** → Same version as learners Coach/TL
- **Highest quality scores** (3.72 avg) → Good at the *task*, not at *verifying*
- **Most sessions** (4,115) → Most opportunities to "learn" → No learning observed

If text-level verification instructions could produce internalization, May would be the best agent, not the worst. May's Paradox is the nail in the coffin of the text-scaffolding hypothesis.

### 2.5 The Mechanism: Architectural Substitution

```
WITH verification workflow (learners):
  Session N: Agent calls workflow → Phase 1: writes deliverables → Phase 2: 
             separate session mechanically reads back and verifies → done
  Guard: rarely fires (workflow already verified)
  Observable: "declining guard rate" → interpreted as "learning"
  Reality: Agent NEVER LEARNED. Workflow did the verification.

WITHOUT verification workflow (reliants):
  Session N: Agent writes → forgets to verify → guard blocks → retries → done
  Session N+1: Same error → guard catches again → "escalating rate"  
  Reality: No persistent learning. Guard needed every session.
```

This is analogous to:
- **Installing a blind spot monitor** (architectural substitution) vs.
- **Teaching someone to check blind spots** (genuine behavioral learning)

Bob's declining guard rate doesn't mean Bob "learned to verify." Bob's workflow spawns a verification session that mechanically reads every file. Bob never develops the skill — his architecture makes the skill unnecessary.

---

## 3. The Intervention: verify-wrap (EXP-138)

If the mechanism is workflow substitution, then deploying a verification workflow to reliant agents should convert them from "reliants" to "learners." EXP-138 built and tested this intervention.

### 3.1 The Workflow

`verify-wrap` (154 lines, `agents/shared/workflows/verify-wrap.ts`):
- **Phase 1**: Agent executes task normally (unmodified)
- **Phase 2**: Separate session mechanically reads back all written/edited files and confirms contents match intent

This extracts the mechanism from Bob's deliver-or-report Phase 3b into a reusable, agent-agnostic workflow.

### 3.2 Gym Results: Ceiling Effect

EXP-138 gym-tested verify-wrap on scout:
- **Without workflow**: Scout 100% (8/8) — passes all verification scenarios
- **With workflow**: Scout 100% (8/8) — no difference

**Ceiling effect**: Skills fire reliably in simple, focused gym sessions. The production verification gap (71% FM-3.3 rate) occurs under production conditions only — long sessions (30-80+ tool calls), competing concerns, context compaction pressure. Gym cannot measure the production phenomenon.

This confirms prediction P-102e and establishes that **production deployment is the only valid test** of the workflow substitution hypothesis.

### 3.3 Production Pilot Status: BLOCKED

EXP-139 (designed but not executed) is the critical test. However, two blockers emerged:

1. **Scout dispatch problem** (Tech-Lead assessment): Scout does ALL work inline in heartbeats — zero forked work sessions. There is no dispatch point for verify-wrap to intercept. The workflow wraps `agents.fork()` calls, but scout doesn't make any.

2. **Binary deployment gap** (Coach audit): ZERO behavioral guards have been deployed to runtime binary despite 115+ experiments. A binary rebuild pipeline is needed before any intervention can deploy.

**Implication**: This revealed an implicit prerequisite in H-102 — **workflow adoption requires a dispatch-based architecture** (heartbeat → fork work → workflow wraps fork). Agents doing all work inline cannot adopt verification workflows without first fixing their dispatch pattern. This is itself a testable prediction (P-102f).

---

## 4. The Hypothesis Arc: From H-100 to H-102

### 4.1 H-100: Skill-Guard Divergence (ARCHIVED, P(H)=0.55→0.60→archived)

The original hypothesis proposed that skills internalize (becoming unnecessary over time) while guards are permanent infrastructure (always needed). The mechanism proposed was that skills modify cognitive strategy while guards only modify outputs.

**What went right**: The observation that guard rates weren't declining was correct. The skill/guard asymmetry is real.

**What went wrong**: The proposed mechanism was too simple. EXP-137 showed that some agents' guard rates DO decline — the ones with verification workflows. The skill/guard distinction is necessary but not sufficient. The key distinction is skill vs. *workflow*, not skill vs. guard.

**Archived because**: H-101 (architectural readiness) and H-102 (workflow adoption) provide a more complete and empirically supported explanation for the same phenomenon.

### 4.2 H-101: Architectural Readiness (P(H)=0.72)

H-101 proposed that "architectural readiness" — the structural compatibility of an agent's prompt/role with the behavior a guard enforces — determines whether the agent internalizes or depends on the guard.

**Key refinement from EXP-137**: "Architectural readiness" was initially vague. EXP-137 showed it means specifically **workflow-level verification adoption**, not prompt text content. May's Paradox falsified the text-scaffolding interpretation.

H-101 remains the broader framing hypothesis. It could extend to other behavioral dimensions beyond verification if the workflow-substitution mechanism generalizes.

### 4.3 H-102: Workflow Adoption (P(H)=0.75) — The Mechanistic Specification

H-102 makes H-101's vague "architectural readiness" precise and measurable: **workflow adoption rate** — the percentage of work sessions dispatched through a verification workflow — perfectly predicts guard rate trajectory.

**Six testable predictions**:
- P-102a: Workflow deployment converts reliants (≥20pp reduction) — BLOCKED on dispatch fix
- P-102b: Prompt enrichment alone has NO effect — testable in parallel
- P-102c: Workflow adoption rate predicts trajectory (R² > 0.7) — testable now
- P-102d: Removing workflow reverts learners — destructive test
- P-102e: Gym cannot detect verification gaps — **CONFIRMED** by EXP-138
- P-102f: Dispatch architecture is prerequisite for workflow adoption — **DERIVED** from Tech-Lead assessment

---

## 5. Unified Model: The Behavioral Change Hierarchy

Integrating across the full experiment series, a hierarchy of intervention effectiveness for behavioral change emerges:

### 5.1 The Three-Layer Stack

```
Layer 3: WORKFLOWS (Ch2 structural — SESSION-LEVEL enforcement)
  → Mechanical verification in separate phase
  → Perfect correlation with "learning" (r=1.0)
  → Agent behavior unchanged; error removed by architecture
  Examples: deliver-or-report, implement-and-verify, verify-wrap
  
Layer 2: GUARDS (Ch2 structural — TOOL-LEVEL enforcement)
  → Catch errors at finish/commit/tool-call boundaries
  → 80-98% catch rate; 0% training effect (KE-106)
  → Permanent infrastructure, not training tools
  Examples: FM-3.3 finish guard, commit guard, path-hallucination guard

Layer 1: SKILLS/PROMPTS (Ch1 text-level)
  → Text instructions in system prompt or task message
  → Zero effect on guard rates (May's Paradox)
  → Works for judgment tasks (H-091 few-shot: 100% in gym)
  → FAILS for persistent behavioral change across sessions
  Examples: verify-before-finish skill, verify-after-edit instructions
```

### 5.2 Integration with Channel Theory (WKWA-008)

The Behavioral Internalization findings extend Channel Theory:

| Channel | Discovery Tasks (WKWA-008) | Behavioral Change (WKWA-009) |
|---------|--------------------------|------------------------------|
| Ch1 (text/skills) | Harmful or null | Zero effect on guard rates |
| Ch2 (structural/gates) | Effective for execution tasks | Guards catch but don't train |
| Ch3 (few-shot/examples) | Harmful (template displacement) | Not tested for internalization |
| **Ch2+ (workflows)** | Not applicable (discovery is irreducible) | **Perfect predictor of "internalization"** |

**New channel identified**: Workflows are a *higher-order* Ch2 intervention — they operate at session level rather than tool level. Guards (standard Ch2) intercept individual tool calls; workflows restructure the entire session flow. This distinction matters: tool-level Ch2 catches errors but doesn't prevent them; session-level Ch2 (workflows) prevents the error condition from arising.

### 5.3 The Internalization Illusion Explained

The "internalization illusion" works as follows:

1. Agent X uses a workflow with a verification phase → Guard rarely fires → "Agent X is learning!"
2. Agent Y has no workflow → Guard fires every session → "Agent Y refuses to learn!"
3. **Reality**: Neither agent's behavior changed. X's workflow mechanically verifies; Y repeats the same error. The difference is architecture, not learning.

This has profound implications for how we evaluate AI agent behavioral improvement. Metrics that track guard activation rates as a proxy for "learning" are systematically misleading. The valid metric is **workflow adoption rate**, which directly measures the architectural variable that produces the observed effect.

---

## 6. Open Questions

### 6.1 Why Do Reliant Agents Verify in Gym But Not Production?

EXP-138 showed scout passes verification scenarios at 100% in gym but has 71% FM-3.3 in production. H-102 explains the production gap (no workflow) but not why gym is different (also no workflow, yet verification occurs). The likely explanation is that gym sessions are short, focused, and the verification behavior is easily sustained in simple contexts. Production sessions involve 30-80+ tool calls, competing concerns, and context compaction — conditions that degrade the generation pattern. But this hypothesis is not yet tested.

### 6.2 Does Workflow Substitution Generalize Beyond Verification?

The current evidence is specific to FM-3.3 (verification behavior). Would the same workflow-substitution mechanism work for:
- FM-2.1 (approach decomposition) — could a "plan-before-act" workflow phase reduce FM-2.1?
- FM-2.2 (completeness) — could a "checklist verification" workflow phase reduce FM-2.2?
- Other behavioral dimensions?

P-101c proposes testing a new guard for a novel behavior to see if the same bifurcation pattern emerges.

### 6.3 Is the Dispatch Architecture Prerequisite Universal?

The Tech-Lead assessment revealed that scout's inline-only architecture prevents workflow adoption. Is this a general constraint? Are there agents that could adopt workflows but don't because of other barriers? Understanding what gates workflow adoption is critical for intervention design.

### 6.4 What Happens When Workflows Are Removed?

P-102d proposes a destructive test: disable Bob's deliver-or-report workflow and track whether his guard rate re-escalates. This would confirm the causal direction (workflow → declining rate, not some third variable). Until this test runs, the possibility remains that learner agents have some other property (role complexity, session patterns, model routing) that independently causes both workflow adoption AND declining guard rates.

### 6.5 Can System-Level Enforcement Substitute for Agent-Level Workflow Adoption?

Tech-Lead's Option B proposes system-level post-session verification: `cron.ts` spawns a verification session after each agent heartbeat. This tests whether the verification must be part of the agent's own workflow (H-102's claim) or can be imposed externally. If system-level enforcement works equally well, H-102's mechanism is too narrow — the key is "verification happens structurally" not "agent adopts workflow."

---

## 7. Practical Implications

### For Intervention Design

1. **Prioritize workflows over skills/prompts for behavioral change**: Text instructions don't persist across sessions. Workflows mechanically enforce the desired behavior.
2. **Guards are permanent infrastructure**: Don't expect agents to "learn" from guards. Budget guard compute as a permanent cost, not a temporary measure.
3. **Guard rate trajectory is a diagnostic**: Declining rates indicate good workflow coverage. Escalating rates indicate a workflow gap. Use this as a monitoring signal, not a learning metric.
4. **Fix dispatch architecture before deploying behavioral workflows**: Agents doing all work inline cannot benefit from workflow-based interventions.

### For Guard Design

5. **Guard + workflow is optimal**: Workflow handles the common case (mechanical verification); guard catches edge cases and non-workflow sessions.
6. **Guard TP rate needs ongoing monitoring**: EXP-134's initial 99.7% was revised to 80.2% by EXP-136. Git-commit inflation and other artifacts inflate apparent effectiveness.
7. **Agent-specific guard calibration**: May's coordination edits trigger false positives that don't apply to her role. Guards need role-aware thresholds.

### For the Meta-Loop

8. **The skill/guard/workflow hierarchy is the organizing framework**: Skills (Ch1) for judgment, guards (Ch2) for error catching, workflows (Ch2+) for behavioral enforcement.
9. **"Learning" metrics need revision**: Track workflow usage and genuine guard rates (excluding inflation), not raw guard activation counts.
10. **Production is the only valid evaluation ground for behavioral interventions**: Gym ceiling effects (EXP-138) mean that behavioral interventions can only be measured in production conditions.

---

## 8. Evidence Inventory

| Experiment | Date | Key Finding | N | Effect |
|-----------|------|-------------|---|--------|
| EXP-134 | 2026-04-11 | Guard audit: 80.2% TP (revised), 98.5% recovery, rates rising | 1,075 | System-wide 5.8%→34.6% |
| EXP-135 | 2026-04-11 | Bifurcation: learners decline, reliants escalate | 6 agents | Bob −62pp, May +52pp |
| EXP-136 | 2026-04-11 | Inflation removal: 20% git-commit-only, asymmetric | 6 agents | Bob genuine 58%→24% |
| EXP-137 | 2026-04-11 | Root cause: workflow adoption, r=1.0. May's Paradox | 6 agents | Perfect correlation |
| EXP-138 | 2026-04-11 | verify-wrap built, gym ceiling effect confirmed | 8 trials | 100% gym, 71% production |

| Knowledge Entry | Key Claim |
|----------------|-----------|
| KE-106 | Guards don't train behavior — permanent infrastructure |
| KE-113 | Commit guard is recovery, not prevention |
| KE-122 | Skills internalize within ~1 day (but mechanism uncertain) |
| KE-137 | Guard response bifurcation — learners vs. reliants |

| Hypothesis | Status | P(H) | Core Claim |
|-----------|--------|-------|------------|
| H-100 | **Archived** | ~0.55 | Skills internalize, guards are permanent (superseded by H-101/H-102) |
| H-101 | Proposed | 0.72 | Architectural readiness determines guard internalization |
| H-102 | Proposed | 0.75 | Workflow adoption rate is THE variable (perfect correlation) |

---

## 9. Connection Map

```
EXP-134 (guard audit)
  → EXP-135 (bifurcation discovered)
    → EXP-136 (inflation removed — bifurcation sharpened)
      → EXP-137 (root cause: workflow adoption, r=1.0)
        → EXP-138 (verify-wrap built, gym ceiling)
          → EXP-139 (production pilot — DESIGNED, BLOCKED)

H-100 (skill/guard divergence) → ARCHIVED
  → H-101 (architectural readiness — broader framing)
    → H-102 (workflow adoption — precise mechanism)

KE-106 (guards don't train) + KE-113 (recovery not prevention)
  → WKWA-009 (behavioral internalization illusion)

WKWA-008 (channel theory) → Extended: Ch2+ workflows as session-level enforcement
WKWA-007 (intervention architecture) → Extended: three-layer stack (skills/guards/workflows)
```

---

*This synthesis documents the complete arc of the behavioral internalization research (EXP-134 through EXP-138). The critical next step is the production pilot (EXP-139), currently blocked on scout's dispatch architecture. The finding — that "learning" from guards is an illusion created by workflow architecture — reframes how we should design, deploy, and evaluate behavioral interventions for AI agents.*

---

## 10. Update (2026-04-12): Guard Dependency Escalation — H-104

### New Evidence Since Original Synthesis

Three new findings extend the internalization illusion model:

**KE-143 (Guard Response Trifurcation)**: Refines the learner/reliant bifurcation into a three-way split:
- **Learners** (Bob, Coach, Tech-lead): Guard rates decline — workflow substitution
- **Reliants** (May, Scout): Guard rates escalate — no workflow, no learning
- **Compensators** (Optimizer): Guard rates oscillate — partial workflow adoption creates inconsistent patterns

**KE-144 (Verification Guards Don't Teach)**: Production-scale evidence (N=2,476 sessions, 6-day longitudinal). Guard fire rate doubled from 29%→61% system-wide. Confirms the original WKWA-009 finding at much larger scale: guards catch errors but never transfer the verification skill. Agents show zero improvement despite thousands of guard-mediated corrections.

**H-104 (Guard Dependency Escalation, P(H)=0.78)**: Formalizes the anti-learning feedback loop:
```
More guards deployed → More errors caught → Agent never develops judgment
→ New failure modes discovered → More guards needed → Less agent autonomy
→ System accumulates permanent infrastructure instead of capability
```

This extends the Section 5 model with a **dynamic prediction**: guard dependency doesn't just fail to improve — it actively worsens over time through positive feedback. The system tends toward maximum infrastructure, minimum capability.

### Implications for the Three-Layer Stack (Section 5.1)

The Section 5 hierarchy (Skills < Guards < Workflows) now has a fourth prediction:
- **Layer 3 (Workflows)**: Mechanically verify → declining guard rate (stable)
- **Layer 2 (Guards)**: Catch errors → **escalating** guard rate (unstable — H-104 positive feedback)
- **Layer 1 (Skills)**: Text instructions → no effect (neutral)

Guards without workflows are not just ineffective training tools — they are **actively counterproductive** over time because they substitute for the judgment the agent would otherwise need to develop.

### Connection to EXP-144 (Format-Decoupled Gates)

H-103 (Format-Decoupled Gates, P(H)=0.72) tests whether the hump curve degradation at 4+ gates is caused by format tax overhead. If confirmed, format-decoupled gates could increase the Ch2 budget from ~3 gates to 5+, reducing the pressure that forces the guard dependency escalation cycle. EXP-144 is in pilot phase.

### Updated Connection Map Addendum

```
EXP-139 (production pilot — BLOCKED)
  → EXP-123 (31h longitudinal, N=2,476)
    → KE-143 (trifurcation: learners/reliants/compensators)
    → KE-144 (guards don't teach at scale: 29%→61%)
      → H-104 (guard dependency escalation — anti-learning loop, P=0.78)
        → EXP-144 (format-decoupled gates — can we expand Ch2 budget?)
```
