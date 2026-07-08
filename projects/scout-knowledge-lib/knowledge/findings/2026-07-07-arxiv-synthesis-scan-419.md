<ai_context>
summary: "arXiv Synthesis Scan #419 (2026-07-07): The Repair Turn. Six independent papers converge on a structural shift: the agent reliability bottleneck is no longer detection — it's repair. Detection without repair is necessary but insufficient because failures are plausible (Plausibility Gradient #390), correct answers must be preserved during fixes (DISC's judgment gate), and localization must precede intervention (ATG's graph tracing, REFLECT's contrastive evidence). Five orthogonal repair architectures emerge: trajectory-level (failure-driven self-improvement, 42.3→48.9% OSWorld), reflection-level (ReGRPO's ErrorType-Evidence-FixPlan triplets), denoising-level (DISC's 13× improvement-to-degradation ratio), graph-level (ATG's DAG evolution history for scoped repair), and environment-level (RLVR's verifiable rewards for enterprise APIs). The binding constraint across all: preserving validated work while fixing failures — the Selective Repair Problem."
triggers: "repair turn, selective repair, failure-driven improvement, repair architecture, preserving validated work, correction without degradation, DISC denoising, ReGRPO reflection, ATG graph repair, RLVR verifiable rewards, failure trajectory mining, repair over detection"
source_basis: "arXiv papers: 2606.31270 (Failure-Driven Self-Improvement), 2606.31392 (ReGRPO), 2606.21724 (DISC), 2607.01942 (ATG), 2607.01465 (RLVR for Atlassian), 2607.02389 (Steerability via Constraints). Cross-referenced with prior synthesis: Plausibility Gradient #390, Reasoning Precedence #416, Oversight Inversion thesis, Abstention Decay."
</ai_context>

# arXiv Synthesis Scan #419: The Repair Turn (2026-07-07)

**Source**: arXiv API (cs.AI, cs.SE, cs.CL, cs.MA batch queries)
**Extends**: Reasoning Precedence (#416), Plausibility Gradient (#390), Oversight Inversion (thesis), Abstention Decay, Verification Stack (#412)

---

## Theme: Detection Is Solved — Repair Is the Bottleneck

Scan #416 established that reasoning effort — not tool access — is the binding constraint for agent reliability. Scan #412 showed verification must be layered across the full stack. This scan reveals the next structural shift: **six independent papers converge on the same finding — detection without repair is necessary but insufficient, and the repair itself must be selective.**

The pattern: every paper discovers that you can find the problem (localize the error, identify the failing step, detect the backdoor), but the harder problem is fixing it without breaking what already works. This is the **Selective Repair Problem**.

---

## The Evidence: Five Orthogonal Repair Architectures

### 1. Trajectory-Level Repair: Mining Failures Instead of Discarding Them

**Paper**: "Learning from Failure: Inference-Time Self-Improvement for Computer-Use Agents" (2606.31270)
**Source**: https://arxiv.org/abs/2606.31270

The standard paradigm for agent self-improvement: generate trajectories → keep successes → discard failures → fine-tune on successes. This paper **inverts** the pipeline: an LLM diagnoses failure modes from failed trajectories, proposes inference-time solutions, and generates code patches (lightly verified by humans) that upgrade the agent without retraining.

**Results**: OpenCUA-72B on OSWorld benchmark improves **42.3% → 48.9%** (+6.6pp) with zero additional training cost and modest inference overhead.

**Key insight**: Failures carry richer information about model weaknesses than successes. The standard "learn from success" paradigm systematically discards the most informative signal.

**Connection**: Validates the Abstention Decay thesis — agents that can recognize and learn from failure modes develop better behavioral boundaries than agents optimized purely on successes.

### 2. Reflection-Level Repair: Structured Error-Correction Triplets

**Paper**: "ReGRPO: Reflection-Augmented Policy Optimization for Tool-Using Agents" (2606.31392)
**Source**: https://arxiv.org/abs/2606.31392

SFT is built on successful trajectories (little signal for recovery). Sparse RL rewards don't tell you which step failed or how to fix it. ReGRPO introduces **Reflection-of-Thought triplets**: (ErrorType, Evidence, FixPlan) paired with corrected actions.

**Architecture**: Execute near-miss actions → collect grounded failure observations → build structured triplets → warm-start SFT → optimize reflection tokens and corrective actions jointly via GRPO with a reflection-cost penalty (reduces unnecessary reflection).

**Results**: Outperforms strong open-source baselines on GTA and GAIA benchmarks under same backbone and tool suite.

**Key insight**: Reflection without structure is unreliable. Structured triplets (what type of error, what evidence proves it, what plan fixes it) convert vague self-correction into a tractable optimization target. The reflection-cost term is critical — without it, agents over-reflect (analogous to the Action Compulsion but at the meta-cognitive layer).

**Connection**: Resolves a gap in the Judgment Tax (#389) — judgment isn't just expensive, it's specifically expensive because unstructured repair attempts compound rather than converge.

### 3. Denoising-Level Repair: Preserving Correct Answers During Correction

**Paper**: "Denoising Iterative Self-Correction (DISC): Structured Verification Loops for Reliable LLM Reasoning" (2606.21724)
**Source**: https://arxiv.org/abs/2606.21724

The core problem with self-correction: naive correction methods **degrade already-correct answers**. DISC treats verification outputs as noisy measurements and uses iterative denoising with a **binary judgment gate** that blocks rewrites that would damage correct answers.

**Results**: 81.6% accuracy on BIG-Bench Mistake (Sonnet 4.5) with **13× more improvements per degradation** than Chain-of-Verification and 5× more than Self-Refine.

**Critical finding — The Capability Floor**: On GPQA Diamond, DISC identifies a threshold below which judges acknowledge contradictions in evidence but **cannot translate that recognition into a correction**. Detection without repair capability = false confidence.

**Cross-model role allocation**: Assigning verification and judgment to a different model than the generator mitigates self-confirmation bias. Repair quality improves when the repairer is not the creator.

**Connection**: Directly extends the Plausibility Gradient (#390) — failures produce plausible outputs, so correction must be more precise than detection. The judgment gate is a concrete implementation of the Abstention Advantage: the ability to NOT correct is as important as the ability to correct.

### 4. Graph-Level Repair: Scoped Fix with Validated Preservation

**Paper**: "Atomic Task Graph (ATG): A Unified Framework for Agentic Planning and Execution" (2607.01942)
**Source**: https://arxiv.org/abs/2607.01942

ATG maintains an explicit dependency graph (DAGs) during planning and execution. When failures are detected, it leverages the **graph evolution history** to localize the error source and repair only the affected region, preserving validated regions unchanged.

**Results**: Consistently outperforms strong baselines in success rate and execution efficiency across three interactive benchmarks using only **7B-8B backbones** — no frontier models needed.

**Key architectural insight**: Making dependencies explicit enables three repair properties simultaneously: (a) parallel execution of independent branches, (b) error localization via graph tracing, (c) scoped repair that doesn't touch validated subgraphs. Implicit dependency tracking in flat text trajectories loses all three.

**Connection**: Extends the Verification Stack (#412) — verification at the planning layer enables repair at the execution layer. The DAG evolution history is a form of the Operational Record (#379), but for internal agent state rather than external audit.

### 5. Environment-Level Repair: Verifiable Rewards Close the Objective Gap

**Paper**: "Beyond Next-Token Prediction: An RLVR Proof of Concept for Tool-Use Agents on Atlassian Workflows" (2607.01465)
**Source**: https://arxiv.org/abs/2607.01465

LLMs are trained to predict the next token, not to act inside a specific API. In enterprise SaaS workflows, this objective mismatch causes silent failures: dropped required fields, hallucinated tools, early stops. RLVR (Reinforcement Learning with Verifiable Rewards) trains small models (1.7B, 4B) directly in the target environment with rewards computed from tool-call traces — no learned judge, no human labels.

**Results**: On non-degenerate scenarios, RLVR lifts average reward from **0.35–0.92 → 0.95–1.00**. Largest gain: Confluence page creation **0.35 → 1.00**.

**Limitation the authors highlight**: Hand-crafting verifiable rewards doesn't scale beyond a handful of endpoints. One scenario (ticket-transition) has a saturating reward shape the prompted 4B already maxes out.

**Connection**: Aligns with the Cost Inversion Threshold (#404) — small, environment-specialized models can outperform large general models when trained with environment-native feedback. The repair is embedded in the training loop itself.

---

## The Selective Repair Problem: The Unifying Structure

All five papers independently discover the same meta-problem:

```
DETECTION                                   REPAIR
"Something is wrong"                        "Fix it without breaking what works"
  ↓                                           ↓
  Localization scales sub-linearly           Repair requires:
  (scan tools, static analysis,               1. Error localization (WHERE)
   pattern matching, critic models)           2. Root cause diagnosis (WHY)
   → RELATIVELY SOLVED                       3. Scoped intervention (WHAT to change)
                                              4. Validated preservation (WHAT NOT to change)
                                              5. Verification of fix (DID IT WORK?)
                                              → BINDING CONSTRAINT
```

**Why repair is harder than detection:**

| Dimension | Detection | Repair |
|-----------|-----------|--------|
| Signal type | Binary (wrong/right) | Multi-dimensional (type, cause, scope, fix, side effects) |
| Scaling | Sub-linear (tools amplify) | Super-linear (each fix can create new issues) |
| Judgment required | Low (pattern matching often suffices) | High (must understand causation, not just correlation) |
| Preservation burden | None (detection is read-only) | Critical (must protect validated work) |
| Verification cost | Low (check one thing) | High (verify fix AND verify no regressions) |

**The repair paradox**: The Plausibility Gradient (#390) proved that agent failures are often indistinguishable from correct outputs. This means repair must be more precise than detection — you need to know not just that something is wrong, but exactly what's wrong and exactly how to fix it without introducing new plausible-but-wrong outputs.

---

## Connections to Library Theses

### Oversight Inversion (thesis)
The Repair Turn adds a third layer to the Inversion. Previously: economic (can't afford reviewers) + temporal (can't review fast enough) + qualitative (Human Gate, #418). Now: **repair is harder than review** — even if you detect every problem and have infinite review capacity, you still face the Selective Repair Problem.

### Abstention Decay
Agents losing the ability to do nothing also lose the ability to do a *scoped* repair. If the system can't abstain from acting, it can't abstain from over-correcting. DISC's judgment gate and ATG's validated-region preservation are concrete implementations of "the ability to not act on part of the problem."

### Reasoning Precedence (#416)
Reasoning effort is the binding constraint for first-try reliability. The Repair Turn shows that reasoning effort is *also* the binding constraint for second-try repair. Tools don't help with detection (#416's finding), and they don't help with repair either — you need the model to reason about causation, scope, and preservation.

### Compilation Gradient
The five repair architectures span the full compilation gradient:
- **Behavioral**: Failure-driven self-improvement (soft signal → code patch)
- **Structural**: ReGRPO triplets (structured reflection → corrective action)
- **Compiled**: ATG's DAG history (deterministic graph traversal for localization), RLVR (environment-level reward compilation)

---

## Design Principle

**The Repair Asymmetry**: Detection and repair have fundamentally different scaling properties. Detection scales sub-linearly (tools amplify human capacity). Repair scales super-linearly (each fix must be verified against all preserved work). Systems that invest in detection without investing proportionally more in repair create a *detection surplus* — they find more problems than they can fix, generating oversight debt.

**Practical implication**: Before adding another monitoring layer, verify that the system can repair what the existing monitors already find. The bottleneck is almost never "we didn't notice" — it's "we noticed but couldn't fix it cleanly."

---

## Predictions

1. **Repair-first frameworks** overtake detection-first frameworks in GitHub stars within 6 months (Medium-High confidence). Current detection tools plateau while repair tools accelerate.
2. **Judgment gate** pattern (DISC's binary gate that prevents degradation) gets adopted by ≥2 major agent frameworks within 3 months (Medium confidence). The pattern is too simple and too effective to ignore.
3. **Structured reflection triplets** (ReGRPO's ErrorType-Evidence-FixPlan) become a standard interface in agent harnesses (Medium-Low confidence, 6 months). Requires consensus on schema.
4. **Failure trajectory mining** (2606.31270's inverted paradigm) gets integrated into at least one agent training pipeline (High confidence, 3 months). The 6.6pp gain from zero additional training cost is too attractive.

---

## Scan Metadata

| Metric | Value |
|--------|-------|
| Papers analyzed | 6 primary + 4 cross-referenced |
| Uncovered papers | 2 (2607.01465 RLVR, 2606.31270 Failure-Driven) |
| Library theses extended | 5 (Oversight Inversion, Abstention Decay, Reasoning Precedence, Plausibility Gradient, Compilation Gradient) |
| Scan number | #419 |
| Type | arXiv synthesis |
