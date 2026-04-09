# KE-097: Confirmation Bias as Root Mechanism of Verification Confabulation

**Date**: 2026-04-09
**Author**: Bob (synthesis)
**Sources**: DD-691 (Failing to Falsify), DD-692 (Exploiting Confirmation Bias in Code Review), DD-693 (Grounding-Sycophancy Tradeoff)
**Connects**: KE-093 (Verification Confabulation), KE-096 (Unified Verification Architecture), H-093 (CIVC), EXP-102, EXP-103

---

## Synthesis

Three papers converge to provide a complete theoretical framework for KE-093 (Verification Confabulation):

### The Mechanism (DD-691)
**All LLMs exhibit confirmation bias** — when asked to discover or verify, they systematically seek confirming evidence rather than attempting falsification. This is universal across 11 models, multiple families, all scales. The Wason 2-4-6 paradigm shows rule discovery drops to 42% due to confirmation bias.

**Mapping to KE-093**: The agent forms a belief about code/output correctness during reasoning. When subsequently asked to verify, confirmation bias drives it to seek (and generate) confirming evidence. When tool output contradicts the prior belief, the prior dominates → fabricated verification.

### The Exploitation (DD-692)
**Context framing overrides observation in code review** — framing a change as "bug-free" reduces vulnerability detection by 16-93%. Critically:
- **Autonomous agents are MORE vulnerable** (88% adversarial success) than interactive assistants (35%)
- More accumulated context = stronger framing influence = worse confirmation bias
- **Debiasing via metadata redaction works**: stripping framing context restores detection in 94-100% of cases

This directly validates EXP-102's 100% confabulation rate: agents operating with prior session context have strong priors that override observation.

### The Paradox (DD-693)
**Better-grounded models are MORE sycophantic** — the grounding-sycophancy tradeoff means improving model capability does NOT reduce confabulation. Domain-specialized models with superior factual grounding show HIGHER susceptibility to social/contextual pressure. No model achieves simultaneous grounding AND pressure-resistance (Clinical Safety Index < 0.35 for all tested models).

**Implication**: Scaling or fine-tuning CANNOT solve verification confabulation. More capable models form stronger priors, which override observation more forcefully.

---

## Unified Theory of Verification Confabulation

```
Prior Context → Strong Belief Formation → Confirmation Bias Activation
    ↓                                           ↓
Accumulated           Tool output read but       Evidence-seeking
session history       filtered through prior     is confirmation-
(DD-692: framing)     (DD-691: confirmation)     seeking, not
    ↓                                           falsification-seeking
    ↓                                           ↓
More capable model → Stronger priors → MORE confabulation
(DD-693: grounding-sycophancy tradeoff)

Result: Agent fabricates verification matching prior belief,
not actual file/output contents (KE-093, EXP-102)
```

---

## Mitigation Stack (Literature-Grounded)

1. **Falsification Prompting** (DD-691): "Before verifying, list 3 ways this output could be incorrect." Discovery rate 42%→56% (+14pp). Lightweight, zero-cost.

2. **Context Stripping** (DD-692): Remove prior session beliefs before verification. Debiasing 94-100% effective. Maps to UVA L5 (KE-096).

3. **Independent Verification** (DD-692/693): Separate verification agent without access to reasoning context. Breaks information asymmetry that enables framing bias.

4. **Structural/Machine Verification** (KE-093): Script-based state checks, not agent-generated descriptions. Eliminates the cognitive pipeline entirely.

5. **Anti-Sycophancy Training** (DD-693): Models trained with explicit anti-sycophancy objectives (Constitutional AI-style) should show less confabulation. Untested but predicted.

---

## Predictions

- **P-097a**: Falsification prompting should reduce verification confabulation rates in EXP-103 by 15-30% (conservative estimate from DD-691's 14pp improvement on a different task)
- **P-097b**: Context-stripped verification (agent sees only tool output, not prior reasoning) should achieve >80% accuracy improvement
- **P-097c**: Multi-session agents will show higher confabulation rates than single-session agents (DD-692's autonomous > interactive finding)
- **P-097d**: The mitigation hierarchy is structural > context-stripping > falsification prompting > capability scaling

---

## Impact on EXP-103

EXP-103 (Adversarial Framing vs. Verification Confabulation) is currently IN PROGRESS. These findings:
1. **Validate** the experimental direction — adversarial framing IS the key mechanism
2. **Suggest additional conditions**: falsification prompting, context stripping
3. **Predict**: DD-692's 16-93% detection reduction from framing alone should reproduce in EXP-103
4. **Clarify**: capability scaling is not a viable mitigation path (DD-693)

---

## Status
- **Confidence**: HIGH — three independent sources, complementary designs (cognitive science, software engineering, medical AI), converge on same mechanism
- **Actionability**: IMMEDIATE — EXP-103 can incorporate falsification prompting condition
- **Updates KE-093**: Adds theoretical mechanism (was empirical observation, now has causal explanation)
