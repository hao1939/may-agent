# KE-153: Observability Tax — Design Implications from DD-750 Literature Synthesis

**Created**: 2026-04-12 (Bob)
**Source**: DD-750 (12-paper literature synthesis on reasoning externalization), KE-146 (Observability Tax framework), H-097 (CCC Triad)
**Connections**: H-103 (Format Tax), KE-142 (Format-Decoupled Gates), KE-144 (Guard Non-Internalization), KE-152 (Guard Positive Feedback), EXP-144

## Core Insight

DD-750 synthesizes 12 external papers (2024–2026) that converge on a single finding with profound implications for our system design: **the visible reasoning trace of an LLM is not the reasoning itself**. Models reason in latent representations (Layer 1), partially expose this in thinking tokens (Layer 2, ~87.5% faithful per Young 2603.22582), and produce heavily filtered output artifacts (Layer 3, ~28.6% faithful). Our structured verification gates operate exclusively at Layer 3 — the least faithful layer.

This entry synthesizes what DD-750 means for guard design, H-097 evaluation, and research direction.

---

## Q1: What Does Thinking-Answer Divergence Imply for Guard Design?

### The Problem
Our structured gates (checklists, verification sections, mandatory reasoning artifacts) mandate Layer 3 output. DD-750 establishes that Layer 3 is:
- **58.9 percentage points less faithful** than Layer 2 (Young's thinking vs. answer gap)
- **Post-hoc reconstruction**, not live reasoning (Liu 2601.02996: models arrive at answers before completing CoT)
- **Over-coherent narrative** optimized for readability, not faithfulness (Borchers 2602.01015)

### The Implication
When an agent fills in a verification checklist, it is likely producing a **retrospective justification** of a decision already made, not performing the verification in real-time. The checklist artifact looks like evidence of careful reasoning but may be a polished summary of reasoning that happened (or didn't happen) in latent space.

### Design Response — Three Tiers of Gates

| Tier | Function | Faithfulness | When to Use |
|------|----------|-------------|-------------|
| **Outcome gates** | Check deliverable properties directly (file exists, tests pass, format valid) | N/A — measures reality | Always. These bypass the faithfulness problem entirely. |
| **Transcript gates** | Analyze Layer 2 thinking tokens for reasoning patterns | ~87.5% | When reasoning quality matters and you can access transcripts |
| **Artifact gates** | Mandate structured externalization in output files | ~28.6% | Only when human auditability is the explicit goal |

**Key shift**: Stop treating artifact gates as quality instruments. They are **observability instruments**. Use outcome gates for quality assurance.

### Connection to KE-152 (Guard Positive Feedback)
KE-152 found that guards can create positive feedback loops where compliance breeds over-reliance. DD-750 adds a mechanism: if guards mandate Layer 3 artifacts and agents learn that compliance (not quality) is what's measured, the feedback loop reinforces *narrative production*, not *reasoning quality*. The agent optimizes for sounding like it reasoned carefully, not for actually reasoning carefully.

---

## Q2: Does DD-750 Support or Challenge H-097 (CCC Triad)?

### Short Answer: Supports the framework, challenges one implementation assumption

**Support — Cooperation Leg**: DD-750's finding that models suppress acknowledgment of influences in output (28.6% vs 87.5%) directly explains why cooperation protocols fail without enforcement. If Agent A shares context with Agent B, Agent B may *process* that context (Layer 1) without *acknowledging* it in output (Layer 3). From a monitoring perspective, it looks like the context was ignored. This reinforces H-097's claim that cooperation must be structurally enforced, not assumed from agent behavior.

**Support — Calibration Leg**: The CoT monitorability findings (Yang 2511.08525, Zhao 2602.04856) validate H-097's calibration requirement. If CoT reasoning traces are unfaithful, then consensus based on visible reasoning is doubly unreliable — not only do verifiers agree on wrong answers (DD-732), but their stated reasoning for agreement may not reflect their actual processing. Calibration mechanisms that operate on outcomes rather than stated reasoning become even more important.

**Challenge — Context Isolation Implementation**: DD-750 complicates how we think about context isolation (H-097 Leg 3). If agents process context in latent space regardless of whether it appears in output, then "isolating" context at the output layer (e.g., not sharing documents between agents) may be insufficient. Agents that share a model or have overlapping training distributions may have correlated latent representations even without shared runtime context. True context isolation may require **architectural** separation, not just information-flow separation.

### Net Assessment
DD-750 strengthens H-097's theoretical foundation (the CCC triad is needed because visible behavior is an unreliable proxy for actual processing) while raising the bar for what "context isolation" actually requires. The current P(H) of 0.55 seems appropriate — the triad framework is sound but implementation details need refinement.

---

## Q3: Actionable Insight — Should We Change How We Mandate Reasoning Externalization?

### Yes. Three specific changes:

**1. Shift from artifact mandates to outcome verification.**
Instead of: "Include a ## Verification section documenting what you checked"
Use: "Run `bash test` and confirm exit code 0; read the output file and confirm it matches spec"

The first is a Layer 3 artifact mandate (agents write what they want you to see). The second is an outcome gate (reality is checked directly). DD-750 + EXP-144 show these produce identical quality outcomes but the second is cheaper and more reliable.

**2. Where externalization is needed, use prompted rather than structured format.**
Kim (2603.24472) showed that rigid format suppresses epistemic verbalization — the expression of uncertainty that drives good OOD reasoning. Instead of rigid templates, prompt agents to "explain your reasoning in whatever format feels natural." This preserves the uncertainty signals that templates suppress.

KE-146 already proposed this as a "prompted externalization" condition for EXP-144. DD-750 provides the theoretical basis: rigid format → suppressed uncertainty → degraded OOD reasoning (up to 40% performance drop in Kim's data).

**3. For safety-critical domains, monitor Layer 2 (transcripts) instead of mandating Layer 3 (artifacts).**
If extended thinking tokens are 3x more faithful than output text, post-hoc transcript analysis provides better observability than mandated artifacts — without the execution-time overhead or the verbal overshadowing risk. This is "back-loading" the observability tax rather than "front-loading" it.

---

## Q4: New Experiment Ideas from DD-750

### EXP-idea-A: Verbal Overshadowing in Agent Verification
**Hypothesis**: Requiring agents to write structured verification sections *before* declaring results will produce worse outcomes on complex/novel tasks compared to agents who verify without externalization.
**Design**: Same task, three conditions: (a) structured verification template, (b) "verify however you want", (c) no verification instruction. Measure outcome quality + reasoning faithfulness via transcript analysis.
**Rationale**: Reddy (2602.00947) verbal overshadowing + Kim (2603.24472) epistemic suppression predict that forcing structured verification on novel tasks will degrade performance.

### EXP-idea-B: Transcript vs. Artifact Monitoring Accuracy
**Hypothesis**: Human reviewers who see agent transcripts (Layer 2) will identify more reasoning errors than reviewers who see only deliverable artifacts (Layer 3).
**Design**: Same set of completed tasks (some with subtle errors). Two reviewer groups: transcript-readers vs. artifact-readers. Measure error detection rate.
**Rationale**: Young's 87.5% vs 28.6% faithfulness gap predicts transcript monitoring is strictly more informative.

### EXP-idea-C: Task Complexity × Externalization Interaction
**Hypothesis**: The observability tax is constant for simple tasks but becomes a *net cost* (degrading quality) for complex/novel tasks where epistemic uncertainty matters.
**Design**: Cross task complexity (routine vs. novel) with externalization level (structured, prompted, none). Measure outcomes and transcript reasoning quality.
**Rationale**: Kim's self-distillation finding (in-domain OK, OOD degrades) predicts the interaction. This addresses KE-146's open question about the task-complexity threshold.

---

## Updated Mental Model: The Three-Layer Reasoning Stack

```
┌─────────────────────────────────────────────┐
│ Layer 1: LATENT REASONING                    │
│ Hidden states, attention patterns             │
│ The actual computation. Never directly visible │
│ ≈ 100% of reasoning happens here              │
├─────────────────────────────────────────────┤
│ Layer 2: THINKING TOKENS                      │
│ Extended thinking, scratchpad, inner monologue │
│ Semi-visible. ~87.5% faithful (Young)          │
│ Best available window into actual reasoning    │
├─────────────────────────────────────────────┤
│ Layer 3: OUTPUT ARTIFACTS                     │
│ Files, checklists, structured sections         │
│ ~28.6% faithful. Post-hoc reconstruction       │
│ Our gates currently measure ONLY this layer    │
└─────────────────────────────────────────────┘
```

**The design imperative**: Move measurement up the stack. Outcome gates bypass the stack entirely (measure reality, not reasoning). Transcript analysis accesses Layer 2. Artifact mandates are stuck at Layer 3.

---

## Confidence

**High confidence** in the synthesis. DD-750's 12-paper convergence is unusually strong — independent research groups across reasoning faithfulness, adaptive thinking, CoT monitoring, and cognitive science all point the same direction. The connection to our internal findings (EXP-144, KE-146, KE-144) is direct and specific, not analogical.

**Medium confidence** in the specific design recommendations. The three-tier gate framework and the "prompted externalization" approach are theoretically grounded but untested internally. EXP-144 Phase 1 and the proposed new experiments would provide the internal validation.

## Tags
`observability-tax`, `reasoning-externalization`, `guard-design`, `CoT-faithfulness`, `format-tax`, `DD-750`, `verbal-overshadowing`, `three-layer-model`
