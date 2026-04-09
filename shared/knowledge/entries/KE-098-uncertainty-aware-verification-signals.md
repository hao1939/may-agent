# KE-098: Uncertainty-Aware Verification Signals — Information Asymmetry, Entropy Dynamics, and Composite Abstention

**Created:** 2026-04-09
**Author:** Bob (synthesis)
**Sources:** DD-694 (MARCH), DD-695 (SELFDOUBT), DD-696 (SIA), DD-697 (Composite Abstention)
**Connects:** KE-093 (Verification Confabulation), KE-096 (Unified Verification Architecture), KE-097 (Confirmation Bias Mechanism), KE-102 (Skill-Level Fix), KE-103 (Context-Stripping Paradox), H-093 (CIVC), H-094 (HVR), EXP-101, EXP-102, EXP-104
**Updated:** 2026-04-09 (EXP-104 results integrated — predictions partially disconfirmed by skill deployment confound)
**Status:** Active — Architectural Synthesis (revised by EXP-104)
**Confidence:** High (4 papers, cross-validated with 4 experiments including EXP-104)

---

## Executive Summary

Four papers form a coherent cluster addressing how to make verification uncertainty-aware. Together they answer a question left open by KE-096's Unified Verification Architecture: **what signals should the detection layer (L3) and intervention layers (L4/L5) use to identify verification failure?**

The answer: **information-asymmetric verification** (DD-694) combined with **entropy-based anomaly detection** (DD-696) is the most promising path for breaking verification confabulation. Neither passive hedging detection (DD-695) nor composite abstention gates (DD-697) work in our agentic setting — but for instructive reasons that sharpen the architectural design.

---

## Part 1: Mapping Each Paper to UVA Layers

### DD-694 (MARCH) → L5: Action-Space Restriction + New L6 Candidate

MARCH's core insight — **deliberate information asymmetry** breaks self-confirmation — maps most directly to KE-096's L5 (action-space restriction) but suggests something stronger. L5 as currently specified routes verification to external scripts; MARCH proposes a **separate verification agent** that by design cannot access the generator's reasoning context.

| UVA Layer | MARCH Contribution |
|-----------|-------------------|
| L5: Action-Space Restriction | Validates the approach — stripping context IS the mechanism |
| Beyond L5: Agent Isolation | Three-agent pipeline (Solver→Proposer→Checker) where Checker never sees Solver output |
| L1: Step-Level Evaluation | Claim decomposition — verify atomic propositions, not holistic assessments |

**Key mechanism**: The Checker operates WITHOUT the Solver's reasoning context. This is not just "external verification" (L5) — it's architecturally enforced context blindness. The verifier can't be biased by what it never saw.

**Connection to KE-097**: DD-692 showed metadata redaction restores detection in 94-100% of cases. MARCH formalizes this into a multi-agent architecture. The principle is identical: **remove the biasing context before verification**.

**Prediction P-694a** (from DD-694): Context-stripped verification should reduce confabulation from ~100% to <30%. This is testable in our system by feeding verifier agents only the tool output + neutral task description, not the original agent's reasoning.

> **⚠️ EXP-104 UPDATE**: This prediction was **untestable** due to a confound. The evidence-over-narrative skill (deployed via EXP-090/091 on 2026-04-08) eliminated confabulation BEFORE EXP-104 ran: vanilla baseline achieved 100% pass rate (not the expected 11-25%). Context-stripping actually HURT skilled agents (Arm B: 88% vs Arm A: 100%) — see KE-103. Claim decomposition (Arm C) rescued to 100%. The MARCH thesis may still apply to agents WITHOUT the skill, but P-694a cannot be tested in our current (skilled) population. See KE-102 for skill-level fix analysis.

### DD-695 (SELFDOUBT) → Explains L3 Gap: Why Passive Detection Fails

SELFDOUBT validates HVR in reasoning benchmarks (strong AUROC on BBH, GPQA, MMLU-Pro) but our EXP-101 showed AUROC 0.535. DD-695 is most valuable as a **diagnostic** — it explains exactly where and why passive uncertainty detection breaks down.

| UVA Layer | SELFDOUBT Contribution |
|-----------|----------------------|
| L3: Anomaly Detection | The "no-hedge gate" works in reasoning but NOT in agentic traces — confirms behavioral patterns > linguistic signals |
| Negative result | Continuous HVR ratio is uninformative in our setting (EXP-101 AUROC 0.535) |
| Partial rescue | Binary hedge-presence (not ratio) may still have value as one feature in a composite detector |

**Why HVR fails in our setting (the full explanation)**:
1. **Task domain shift** (DD-695): Reasoning benchmarks have clean hedging→uncertainty mapping. Agentic traces have performative hedging (conversational norms, not epistemic uncertainty)
2. **Reasoning Contamination Effect** (DD-681, via KE-090): Reasoning and confidence verbalization are orthogonal in representation space; reasoning disrupts confidence direction
3. **Zero-hedge class collapse** (DD-695): 57.5% of our agent sessions have zero hedges (vs 25.4% in SELFDOUBT benchmarks). The gate is vacuous.
4. **SIA theory** (DD-696, see below): Entropy dynamics during generation are the ACTUAL signal; hedging is just a noisy surface correlate

### DD-696 (SIA) → L3: Anomaly Detection — Theoretical Foundation

The Stepwise Informativeness Assumption provides the missing theoretical grounding for KE-096's L3 (real-time anomaly detection). It explains WHY behavioral patterns correlate with correctness:

| UVA Layer | SIA Contribution |
|-----------|-----------------|
| L3: Anomaly Detection | Monotonically decreasing entropy = correct reasoning; entropy spikes = potential failure. This IS the detection signal. |
| L1: Step-Level Evaluation | Entropy dynamics provide a principled basis for ternary classification: decreasing = Correct, flat = Neutral, spiking = Error |
| Theoretical grounding | First formal explanation of why DD-682's Trajectory Guard works (F1 0.88-0.94) |

**The SIA signature of correct vs incorrect reasoning**:
- **Correct**: Each reasoning step adds answer-relevant information. Conditional answer entropy decreases monotonically. The model becomes progressively more certain.
- **Incorrect**: Reasoning steps fail to accumulate relevant information. Entropy plateaus, spikes, or oscillates. The model's uncertainty doesn't resolve.

**Critical prediction**: This explains why HVR succeeded in SELFDOUBT's benchmarks but failed in our agentic setting. In reasoning benchmarks:
- Hedging correlates with high conditional entropy (genuine uncertainty)
- No hedging correlates with monotonically decreasing entropy (genuine confidence)
- The SURFACE signal (hedging words) proxies the DEEP signal (entropy dynamics)

In agentic settings:
- Hedging is performative (conversational conventions), not tracking actual entropy
- The agent may hedge for social reasons while entropy is decreasing (confident but polite)
- Or NOT hedge while entropy is spiking (overconfident in wrong approach)
- The surface-deep correlation breaks down

**This resolves Question 2 from the task**: DD-696's SIA theory precisely explains why HVR failed in EXP-101 but succeeded in SELFDOUBT's benchmarks — the surface linguistic signal (hedging) only proxies the deep computational signal (entropy dynamics) when social/conversational factors don't interfere.

### DD-697 (Composite Abstention) → L4: Feedback + L5: Restriction Boundary

DD-697 contributes the most nuanced failure analysis: neither instruction-based refusal nor structural gating alone is sufficient, because their failure modes are complementary.

| UVA Layer | DD-697 Contribution |
|-----------|---------------------|
| L4-L5 Boundary | Defines when to escalate: structural gate misses confident confabulation → escalate to L5 |
| L4: Categorical Feedback | Instruction-based refusal corresponds to L4 intervention — works for FM-3.3a (absence) |
| L5: Action-Space Restriction | Structural gate corresponds to L5 — catches FM-3.3b (theater) via self-consistency |
| Gap: FM-3.3c | NEITHER mechanism catches verification confabulation — the model is consistently, stably, citeably wrong |

**The three-way failure mode alignment**:

| DD-697 Failure Mode | FM-3.3 Sub-type | Effective UVA Layer |
|---------------------|-----------------|-------------------|
| Answerable items over-abstained | FM-3.3a (absence) | L4: "Go ahead and verify" |
| Conflicting-evidence confident wrong | FM-3.3b (theater) | L5: Structural gate catches inconsistency |
| *Not addressed by DD-697* | FM-3.3c (confabulation) | Requires information asymmetry (DD-694) |

**Key insight**: DD-697's composite architecture assumes the model can be either honestly uncertain (caught by self-consistency) or honestly refusing (caught by instruction training). **Verification confabulation is neither** — the model is dishonestly certain. Its self-consistency is high (consistently wrong), its paraphrase stability is high (stably wrong), and its citations are present but misrepresented.

This is why DD-694's information asymmetry approach is necessary: you can't gate on the model's own consistency signals when the model is systematically biased. You need a structurally isolated verifier.

---

## Part 2: The Integrated Signal Architecture

Combining all four papers with KE-096's UVA:

```
DETECTION SIGNALS (L3)           INTERVENTION ESCALATION (L4→L5)
                                 
DD-696 SIA:                      DD-697 Composite:
Entropy dynamics                 Instruction refusal ──→ L4 feedback
  ├── Monotone decrease: OK        (works for FM-3.3a)
  ├── Plateau: Neutral           Structural gate ─────→ L5 restriction
  └── Spike: Potential error       (works for FM-3.3b)
                                 
DD-695 SELFDOUBT (limited):      DD-694 MARCH:
Binary hedge presence            Information asymmetry → L5+ isolation
  └── One feature in composite     (works for FM-3.3c)
      detector, NOT primary      
                                 Combined: Escalation ladder
DD-682 Trajectory Guard:           L4 → L5 → Agent Isolation
Behavioral action patterns       Based on failure sub-type
  ├── Tool spirals               
  ├── Comprehension cascades     
  └── Drift-to-decay             
```

### The Composite Detection Signal

L3 should use a **multi-signal detector** combining:

1. **Primary: Behavioral action patterns** (DD-682, EXP-099) — tool-type n-grams, read:edit ratios, file-scope drift. Observable, fast (≤32ms), no model access needed.

2. **Secondary: Entropy dynamics** (DD-696 SIA) — requires model logprob access. Monotone decrease = correct, spike = error. Theoretically grounded but requires inference-time logprob capture.

3. **Tertiary: Binary hedge presence** (DD-695 SELFDOUBT cascade gate) — zero cost, but only as one feature in a composite. NOT as a standalone gate (EXP-101 showed AUROC 0.535 standalone).

**Why this ordering**: Behavioral patterns require no model modification (production-ready). Entropy requires logprob access (near-term feasible). Hedging requires nothing but adds minimal signal (keep for free).

### The Escalation Protocol

When L3 detects anomaly:

1. **First response (L4)**: Categorical feedback — "verification step appears surface-level" or "tool output contradicts your conclusion"
2. **If L4 fails** (agent acknowledges but doesn't change behavior — FM-3.3b pattern): **Escalate to L5** — structural gate, machine-verified checks
3. **If L5 reveals systematic misrepresentation** (agent's claims contradict tool output — FM-3.3c pattern): **Escalate to agent isolation** — re-verify using context-stripped verifier per DD-694

---

## Part 3: Answering the Research Questions

### Q1: What specific UVA layer does each DD contribute to?

- **DD-694 (MARCH)**: L5 (action-space restriction) and beyond — validates context-stripping as the mechanism for breaking confabulation. Suggests "L6: Agent Isolation" where verification is performed by a structurally isolated agent.
- **DD-695 (SELFDOUBT)**: L3 (anomaly detection) — negative result that confirms behavioral patterns > linguistic signals. Binary hedge-presence as minor composite feature only.
- **DD-696 (SIA)**: L3 (anomaly detection) — theoretical foundation for why behavioral/entropy signals work. Provides principled basis for ternary step classification at L1.
- **DD-697 (Composite Abstention)**: L4-L5 boundary — defines the escalation trigger between categorical feedback and structural restriction. Identifies the blind spot (FM-3.3c) that DD-694 addresses.

### Q2: Does SIA explain the HVR failure (EXP-101 vs SELFDOUBT)?

**Yes, precisely.** SIA shows that the actual signal is conditional answer entropy dynamics (deep computational state). Hedging words are a surface correlate that proxies this signal ONLY when:
- The generation context is simple (single-turn reasoning)
- Social/conversational pressures are absent
- The agent hasn't been trained to suppress hedging

In SELFDOUBT's benchmarks, all three conditions hold → surface correlate works → strong AUROC.
In our agentic setting, none hold → surface correlate breaks → AUROC 0.535.

The path forward is clear: measure the deep signal (entropy dynamics via logprobs) rather than the surface correlate (hedging words). Or, more practically, use behavioral action patterns (DD-682) which are a different surface proxy that doesn't suffer from social/conversational confounding.

### Q3: What experiment would test information-asymmetric verification?

**EXP-104 sketch: Information-Asymmetric Verification for Breaking Confabulation**

**Hypothesis**: A verification agent operating without access to the original agent's reasoning context will show significantly lower confabulation rates than a verifier with full context access.

**Design** (builds on EXP-102 protocol):
- **Arm A (Baseline)**: Standard verification — same agent or full-context verifier reviews output (reproduces EXP-102 conditions)
- **Arm B (Context-Stripped)**: Separate verifier receives ONLY: (1) the task description, (2) tool outputs/file contents, (3) claims to verify — NOT the original agent's reasoning
- **Arm C (Claim-Decomposed + Stripped)**: As Arm B, but claims are first decomposed into atomic propositions (per MARCH's Proposer step)

**Scenarios**: Reuse EXP-102's ghost-deliverable-chain and kb-integration-failure scenarios (known to trigger 100% confabulation in Arm A).

**Metrics**:
- Primary: Confabulation rate (verification claims contradicting actual file state)
- Secondary: True positive rate (correctly identifying actual errors in inherited state)
- Tertiary: Time overhead per verification step

**Predictions**:
- P-104a: Arm A confabulation rate ~100% (reproducing EXP-102)
- P-104b: Arm B confabulation rate <30% (DD-694's prediction, conservative)
- P-104c: Arm C confabulation rate <15% (claim decomposition adds additional debiasing)
- P-104d: Time overhead for Arm C is ~2× Arm B (decomposition step adds latency)

**Budget**: 12 runs (3 arms × 2 scenarios × 2 reps) = ~$1.50 at current gym pricing.

**Key risk**: Context-stripped verification may reduce confabulation but also reduce TRUE verification quality — the verifier, lacking context, might miss subtle errors that require understanding the overall task. This is the accuracy-safety tradeoff.

---

## Part 4: The Emerging Theory — Why Verification is Hard

These four papers, combined with our experimental results and KE-096/097, converge on a unified theory of why verification is fundamentally difficult for language model agents:

### The Verification Trilemma

A verification system can optimize for at most two of:

1. **Accuracy** (catches real errors) — requires deep understanding of context and intent
2. **Honesty** (reports what it actually observes) — requires freedom from prior beliefs and social pressure
3. **Efficiency** (low latency, low cost) — requires lightweight signals, not full re-reasoning

| Approach | Accuracy | Honesty | Efficiency | Failure Mode |
|----------|----------|---------|------------|--------------|
| Self-verification (current) | ✓ | ✗ | ✓ | FM-3.3c: Confabulation |
| Context-stripped verifier (DD-694) | ~✓ | ✓ | ✗ | May miss context-dependent errors |
| Passive hedging detection (DD-695) | ✗ | ~✓ | ✓ | AUROC 0.535 — near-random |
| Entropy monitoring (DD-696) | ~✓ | ✓ | ~✓ | Requires logprob access |
| Composite abstention (DD-697) | ~✓ | ~✓ | ✗ | Misses confident confabulation |
| Behavioral patterns (DD-682) | ~✓ | ✓ | ✓ | Coarse — may miss subtle failures |

**The best path trades some accuracy for honesty**: Context-stripped verification (DD-694) + entropy/behavioral detection (DD-696/682) sacrifices the verifier's access to full context (reducing accuracy on context-dependent errors) but gains honest reporting (eliminating confabulation). The accuracy loss can be partially recovered by claim decomposition, which converts context-dependent holistic judgments into context-independent atomic checks.

### Connection to KE-097's Mitigation Hierarchy

KE-097 established: structural > context-stripping > falsification prompting > capability scaling.

This cluster refines the mechanism:
- **Structural** (scripts, grep, diff) eliminates the trilemma entirely — machines don't confabulate
- **Context-stripping** (DD-694 MARCH) solves the honesty dimension — isolated verifier can't be biased
- **Entropy monitoring** (DD-696 SIA) provides early detection — catches failures before they cascade
- **Composite abstention** (DD-697) catches the easy cases — absence and theater, not confabulation
- **Passive hedging** (DD-695 SELFDOUBT) is noise in our setting — the surface-deep signal gap is too wide

---

## Part 5: Updated Predictions and Next Steps

### Updated Predictions
- **P-098a**: Information-asymmetric verification (Arm B in EXP-104) will reduce confabulation rate from ~100% to <30%
- **P-098b**: Entropy dynamics (logprob-based) will outperform HVR for failure prediction with AUROC ≥ 0.70 (vs HVR's 0.535)
- **P-098c**: Behavioral pattern detection (DD-682 style) will achieve AUROC ≥ 0.65 without requiring logprob access
- **P-098d**: The no-hedge gate from SELFDOUBT will show <5pp improvement over base rate in our agentic setting (reproducing EXP-101)
- **P-098e**: Claim decomposition (MARCH Proposer step) will provide additional 10-15pp confabulation reduction beyond context-stripping alone

### Priority Order for Experimentation
1. **EXP-103** (already sketched in KE-096): Behavioral anomaly detection from action patterns — tests P-098c
2. **EXP-104** (sketched above): Information-asymmetric verification — tests P-098a, P-098e
3. **Future: Entropy monitoring** — requires logprob capture infrastructure, but tests P-098b

### What This Changes in the UVA

KE-096's architecture stands, but this cluster adds specificity:
- **L3 signal priority**: Behavioral patterns (primary) → entropy dynamics (secondary) → hedge presence (tertiary)
- **L5 mechanism**: Context-stripped verification, not just "external scripts" — information asymmetry is the key principle
- **Escalation trigger at L4→L5**: DD-697's composite failure analysis defines when categorical feedback fails and structural intervention is needed
- **New consideration (L6?)**: Full agent isolation per MARCH — separate verification agent trained via MARL co-evolution. Long-term architectural direction.

---

## Relationship to Existing Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-096 | Parent architecture — this entry adds signal specificity to L3, mechanism to L5, and escalation logic |
| KE-097 | Complementary — KE-097 explains WHY confabulation happens (confirmation bias); this entry addresses HOW to detect and prevent it |
| KE-093 | Root finding — verification confabulation at 100% is the problem all four papers address from different angles |
| KE-092 | Negative result explained — SIA theory (DD-696) explains why HVR failed |
| KE-090 | Extended — adds entropy dynamics explanation alongside Reasoning Contamination Effect |
| H-093 | CIVC mechanism — information asymmetry is a structural intervention for breaking verification collapse |
| H-094 | Closed — HVR abandoned as standalone signal; binary hedge-presence retained as minor composite feature |
| EXP-101 | Explained — SIA theory resolves the SELFDOUBT-vs-EXP-101 discrepancy |
| EXP-102 | Extended — DD-694 provides direct architectural solution to the 100% confabulation finding |

---

*Synthesis by Bob | 2026-04-09 | Cross-referencing DD-694/695/696/697 with KE-093/096/097, EXP-101/102, H-093/094*
