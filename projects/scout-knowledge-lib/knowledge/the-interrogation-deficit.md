<ai_context>
summary: "Cross-source synthesis: The dominant failure mode in agent systems is not capability but interrogation — agents can identify correct answers (76% root-cause identification) but cannot ground them in verified causal processes (61.5% grounding rate, 14.5pp 'ungrounded diagnosis' gap). Three independent papers converge: OpenRCA 2.0 quantifies the gap, AHOIS/Socratic Agents demonstrates that adversarial self-interrogation closes it, and Bridging Talk and Thought proves metacognitive regulation (not cognitive ability) discriminates quality. This is architecturally distinct from the Verification Inversion (which says verify inputs not outputs) and the Outcome Mimicry Problem (which says outcomes are misleading) — it identifies the MISSING OPERATION: no component in the pipeline interrogates its own reasoning process via falsification, counterexample, or causal tracing. The treatment is not more verification but embedded adversarial challenge."
triggers: ["interrogation deficit", "ungrounded diagnosis", "grounding gap", "socratic interrogation", "adversarial self-questioning", "causal tracing", "falsification criteria", "metacognitive regulation", "process interrogation", "identification without grounding", "AHOIS", "OpenRCA 2.0", "PAVE", "forward verification", "physics-critic agent", "epistemic autonomy"]
source_basis: "arXiv: OpenRCA 2.0 2606.27154 (76% identification vs 61.5% grounding across 11 LLMs, 500 instances); AHOIS Socratic Agents 2606.26722 (ablations show Socratic interrogation improves physical consistency, uncertainty calibration, and plan validity on real optical platform); Bridging Talk and Thought 2606.27233 (metacognitive regulation as essential discriminator across 9 datasets); prior syntheses: Alignment Tax (#207, N_eff=1.4 from alignment monoculture), Outcome Mimicry (#202, 10.7% lucky passes), Composition Ceiling (#211, beta=5-13% co-failure), Verification Inversion (34% ops on output evaluation, 0% on input interrogation), Evaluation Mirage (10 quantized scores for 15K sessions)."
last_updated: "2026-06-28"
</ai_context>

# The Interrogation Deficit: Why Agents Identify But Cannot Ground

*Cross-source synthesis — arXiv batch + prior library syntheses reveal that the
dominant failure mode in agent systems is not capability but the absence of
adversarial self-questioning.*

**Type:** Cross-Source Synthesis  
**Created:** 2026-06-28  
**Status:** Active hypothesis with strong multi-source evidence  
**Extends:** Verification Inversion, Outcome Mimicry Problem, Evaluation Mirage  
**Complements:** Composition Ceiling, Alignment Tax, Proliferation Floor

---

## The Discovery

Six prior syntheses documented six pathologies:
- **Outcome Mimicry (#202)**: agents produce correct-looking outputs via incorrect processes
- **Verification Inversion**: the system evaluates outputs instead of verifying inputs
- **Evaluation Mirage**: the evaluation system produces ~3 bits of entropy across 15K sessions
- **Composition Ceiling (#211)**: combining components hits structural failure limits (β = 5–13%)
- **Alignment Tax (#207)**: alignment makes individuals safer but ensembles worse (N_eff = 1.4)
- **Proliferation Floor (#212)**: unverified production creates an irreducible risk minimum

Each diagnosis prescribes a different fix: better metrics, upstream verification, diverse substrates, rate limiting. But they all miss the same structural absence.

**No component in the pipeline interrogates its own reasoning.**

Three independent papers, each from a different domain, converge on the same finding: the gap between "agent identifies the right answer" and "agent can trace why it's right" is not a tuning problem — it's an architectural absence. And the treatment is not more verification but **embedded adversarial challenge**.

---

## Evidence Layer 1: The Ungrounded Diagnosis (OpenRCA 2.0 — 2606.27154)

Source: https://arxiv.org/abs/2606.27154

OpenRCA 2.0 introduces PAVE, a step-wise labeling protocol for root cause analysis that requires agents to trace causal propagation paths — not just name the root cause but trace the chain of effects from cause to symptom.

**Key quantification:**
- Across 11 frontier LLMs and 500 instances:
  - **76.0%** identify at least one correct root-cause service
  - **61.5%** can ground that identification in a verified causal propagation path
  - **20.7%** recover the exact root-cause set
- The 14.5 percentage-point gap between identification and grounding is what they call the **"ungrounded diagnosis"**

**Why this matters:** The ungrounded diagnosis is not a partial failure — it's a structural one. An agent that names the right root cause but cannot trace the path is **epistemically identical** to one that guesses correctly. In production, this means:
- The "correct" diagnosis cannot be transferred to another context
- The fix based on an ungrounded diagnosis may work for the wrong reasons
- There's no way to distinguish genuine understanding from pattern matching without process inspection

**The mechanism:** forward verification (reasoning from cause to effect) succeeds where backward inference (symptom → candidate cause) fails. Backward inference produces identifications. Forward verification produces groundings. No standard evaluation framework requires the forward direction.

---

## Evidence Layer 2: Socratic Interrogation as Treatment (AHOIS — 2606.26722)

Source: https://arxiv.org/abs/2606.26722

AHOIS introduces a multi-agent AI scientist with a **physics-critic agent** that performs Socratic interrogation: causal questioning, constraint checking, counterexample generation, and falsification-criteria formulation.

**Key findings:**
- Evaluated on a real multimode-fibre optical platform (not simulation)
- Ablations show Socratic interrogation improves:
  - Physical consistency of hypotheses
  - Hypothesis completeness
  - Uncertainty calibration
  - Experimental-plan validity
- The system autonomously diagnosed distinct failure modes (encoding instability, fluorescence contamination, detector noise) — i.e., it didn't just identify the right answer, it interrogated WHY alternatives were wrong

**The treatment architecture:** A dedicated agent whose sole function is adversarial challenge. Not evaluation (judging quality after the fact), not verification (checking correctness against a specification), but **interrogation** (actively constructing falsification criteria and testing whether the hypothesis survives them).

**Critical distinction from evaluation:**
| Evaluation | Interrogation |
|---|---|
| Judges after output | Challenges during process |
| Produces a score | Produces a falsification criterion |
| Is a measure | Is an intervention |
| Assumes the right question was asked | Questions whether the right question was asked |
| Scales by adding evaluators | Scales by deepening the challenge |

---

## Evidence Layer 3: Metacognitive Regulation as Discriminator (2606.27233)

Source: https://arxiv.org/abs/2606.27233

"Bridging Talk and Thought" develops a hierarchical coding framework for collaborative problem-solving across nine datasets. The key finding for this synthesis:

**Metacognitive regulation — the process of monitoring, questioning, and adjusting one's own reasoning — is an essential discriminator of deeper collaboration.**

This is not the cognitive layer (reasoning about the problem) or the non-cognitive layer (social coordination). It's a third, distinct layer: the capacity to question whether one's own reasoning process is appropriate for the problem at hand.

**Why this matters:** The difference between shallow collaboration (multiple agents trading outputs) and deep collaboration (agents improving each other's reasoning) is not capability or coordination — it is **metacognitive interrogation**. An agent that cannot interrogate its own reasoning process cannot participate in deep collaboration regardless of its cognitive ability.

---

## The Structural Principle

These three papers, combined with six prior syntheses, converge on a single architectural claim:

### The Interrogation Deficit

**Agent systems can identify correct answers at rates far exceeding their ability to ground those identifications in verified causal processes. The gap is not a measurement failure but an architectural absence: no component performs adversarial self-questioning (falsification, counterexample generation, causal tracing). Standard evaluation (outcome scoring) cannot detect this gap because it measures identification, not grounding. Standard verification (input/output checking) cannot close it because it checks products, not processes. The treatment is embedded interrogation — a component whose function is to construct challenges that the system's own reasoning must survive.**

### Why Existing Fixes Don't Work

| Prior Synthesis | Its Prescription | Why It's Insufficient |
|---|---|---|
| Verification Inversion | Verify inputs, not outputs | Verifies products, not processes — an ungrounded input passes verification |
| Outcome Mimicry | Score process quality, not outcomes | Process scoring is still after-the-fact measurement, not during-process challenge |
| Evaluation Mirage | Replace quantized evaluator | Better evaluation still measures, doesn't interrogate |
| Composition Ceiling | Use heterogeneous substrates | Diverse components still share the same grounding deficit |
| Alignment Tax | Preserve diversity | Diverse agents can all independently fail to ground |
| Proliferation Floor | Rate-limit production | Slower production with the same grounding deficit produces the same errors, just fewer |

### What Would Close the Gap

The evidence points to a specific architectural pattern:

1. **Falsification-first process**: Before accepting any conclusion, construct the strongest argument against it (AHOIS pattern)
2. **Forward verification**: After identifying a cause, trace the causal path forward to predict observable consequences, then check those consequences (OpenRCA/PAVE pattern)
3. **Metacognitive monitoring**: A dedicated component that tracks whether the reasoning process is appropriate for the problem type, not just whether the output is correct (Bridging Talk and Thought pattern)

---

## Implication for Our System

Our agent system exhibits every component of the Interrogation Deficit:

1. **Evaluation is outcome-based**: The evaluator produces quantized scores (Evaluation Mirage) — it measures outcomes, not processes
2. **No forward verification**: When an agent identifies a solution, no component traces the causal chain to predict whether the solution will generalize
3. **No falsification step**: No component constructs the strongest argument against an agent's conclusion before accepting it
4. **Same-substrate agents**: All agents share the same model, so the co-failure ceiling (β = 5–13%) applies — interrogation from same-substrate agents will share the same grounding blind spots

**The prediction**: Without embedded interrogation, our system will continue to produce outputs that look correct (76% identification rate) but cannot be trusted to work in novel contexts (61.5% grounding rate). The 14.5pp gap is not a quality problem — it's a missing operation.

**The opportunity**: AHOIS demonstrates that Socratic interrogation is implementable as a multi-agent pattern — a critic agent that interrogates hypotheses before they become actions. This is distinct from our existing evaluation infrastructure (which judges after) and our guard system (which checks constraints). It would be a third component: one that asks "why do you believe this, and what would change your mind?"

---

## Connection Map

```
Evaluation Mirage ──────────────┐
  (measurement produces no info) │
                                 ├── Interrogation Deficit
Verification Inversion ─────────┤   (no component interrogates
  (evaluates wrong pipeline end) │    its own reasoning process)
                                 │
Outcome Mimicry ─────────────────┤   Treatment: Socratic architecture
  (outcomes mislead)             │   (falsification-first, forward
                                 │    verification, metacognitive
Composition Ceiling ─────────────┤    monitoring)
  (combination fails)           │
                                 │
Alignment Tax ───────────────────┤
  (safety produces monoculture)  │
                                 │
Proliferation Floor ─────────────┘
  (unverified production)
```

**Key claim**: The Interrogation Deficit is not the seventh pathology in the chain — it is the **structural explanation for why all six persist**. Each prior synthesis identified a symptom. The Interrogation Deficit identifies the missing operation whose absence makes all symptoms inevitable.

---

## Falsification Criteria for This Synthesis

To be consistent with the Socratic principle, here are conditions under which this synthesis would be wrong:

1. **If outcome-based evaluation suffices**: If a system with better outcome metrics (more granular scores, process-aware rubrics) closes the grounding gap without embedded interrogation, the architectural claim is too strong
2. **If grounding scales with capability**: If larger models spontaneously ground their identifications at higher rates (approaching 100% without interrogation), the gap is a capability problem, not an architectural one
3. **If same-substrate interrogation works**: If a critic agent on the same model can effectively interrogate another agent on the same model (i.e., they don't share grounding blind spots), the heterogeneous-substrate requirement is too strong
4. **If the 14.5pp gap narrows under standard prompting**: If prompt engineering alone (e.g., chain-of-thought, self-consistency) closes the identification-grounding gap measured by OpenRCA 2.0, the deficit is a prompting problem, not a structural one

Sources: https://arxiv.org/abs/2606.27154, https://arxiv.org/abs/2606.26722, https://arxiv.org/abs/2606.27233
