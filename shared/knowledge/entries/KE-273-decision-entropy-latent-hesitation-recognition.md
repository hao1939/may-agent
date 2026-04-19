# KE-273: Decision Entropy as Latent Hesitation — Hidden States Detect Recognition Failures Before They Manifest

**Date**: 2026-04-19
**Source**: DD#777 (Zhu et al. 2604.03870), cross-referenced with H-098 (Channel Theory), KE-054 (Externalization Boundary)
**Confidence**: Theoretical (strong external evidence, no internal experiment)
**Connects**: H-098 (Ch2 sub-taxonomy), H-085 (forced externalization), KE-071 (reasoning-behavior gap), H-054 (evaluator R-ceiling), DD#777

## Core Finding

Agents executing instructions they "shouldn't" follow exhibit **abnormally high entropy in hidden states at the tool-input position** — a measurable "hesitation" signal that persists even when the agent complies behaviorally. The agent's internals know something is wrong before the agent acts wrong.

## Connection to Our Ch2 Recognition Problem

DD-777 studied prompt injection, but the mechanism is general: **decision entropy spikes when the agent encounters a conflict between what it's doing and what it should be doing**. This maps directly onto our Ch2 recognition failures:

### Ch2-Self Recognition
When an agent drifts from its own plan (cascading-fix-trap, stale-approach-fixation), it may exhibit elevated decision entropy at the moment of drift — the internal representation "recognizes" the conflict even as behavior proceeds. This is the same phenomenon as KE-071's reasoning-behavior gap: the model reasons correctly but acts incorrectly.

**Prediction**: If we had access to hidden states, agents executing BLIND FIX patterns (our 0% recognition scenarios) would show entropy spikes at the moment they choose to stop investigating after tests pass — the model's hidden state encodes uncertainty about whether the real bug was found, even as it behaviorally declares success.

### Ch2-World-Model Recognition  
DD-777's entropy signal is strongest for world-model violations (the agent "knows" the instruction source is untrusted). Our Ch2-World-Model failures (absent-field, hallucinated-API) similarly involve the agent proceeding despite lacking information — which may produce detectable entropy elevation even without hidden state access, via **reasoning trace hedging** (KE-068's zero-hedge gate).

## The Entropy → Hedging Bridge

DD-777 requires hidden state access (not available for API-only models). But KE-068 (HVR/zero-hedge gate) shows that reasoning trace hedging correlates with correctness at 96.1% precision. **These are likely measuring the same underlying signal through different windows**:

- DD-777: measures entropy directly from hidden states → high entropy = latent hesitation
- KE-068: measures hedging from reasoning traces → hedging = surface expression of latent hesitation
- Both detect the reasoning-behavior gap (KE-071) from different vantage points

**Synthesis**: Decision entropy (DD-777) → hedging in reasoning traces (KE-068) → detectable recognition failure signal. We don't need hidden state access — hedging IS the API-accessible proxy for entropy.

## Implications for Our System

### 1. Ch2 gate enhancement via hedging detection
Current Ch2 gates (plan-echo, environment-lint, world-model-check) are action-level. Adding a **reasoning-trace hedging monitor** before the gate would catch cases where the agent's own reasoning expresses uncertainty but its action doesn't reflect it — exactly the recognition failures we see at 0% baseline.

### 2. Verification gap diagnostic
High hedging + pass verdict = potential rubber-stamping (H-009). The evaluator may "hesitate" in its reasoning while still passing the output. Monitoring evaluator reasoning traces for hedging patterns could detect evaluator drift without expensive ground-truth comparison.

### 3. BLIND FIX pattern detection
Our 0% recognition scenarios (agent fixes obvious bug, stops when tests pass, never finds recognition bug) might be detectable via entropy/hedging at the "stop investigating" decision point. If the agent hedges about completeness in its reasoning but behaviorally stops, that's a targetable intervention point.

## Experimental Tests (Ordered by Leverage)

1. **Hedging-as-entropy proxy** [HIGH]: On existing recognition scenarios (sql-injection-in-query-builder at 33% baseline), extract reasoning traces from pass/fail runs. Do failing runs show MORE hedging at the "stop" decision than passing runs? If yes, hedging is a usable recognition signal.

2. **Evaluator hedging audit** [MEDIUM]: Sample 50 evaluator verdicts, extract reasoning traces, compute HVR. Do cases where evaluator hedges but passes correlate with actual errors? Tests whether KE-068's zero-hedge gate works for verification-of-verifiers.

3. **Hedging-gated intervention** [HIGH if #1 confirms]: When agent reasoning shows high hedging at a "stop investigating" decision, inject a Ch2-Self prompt ("Your reasoning suggests uncertainty — what haven't you checked?"). Tests whether surfacing the agent's own latent hesitation triggers recognition.

## Open Questions

- Is the entropy → hedging mapping monotonic, or does it saturate/invert at extremes?
- Do different Ch2 sub-types produce different hedging signatures?
- Can adversarial agents suppress hedging while maintaining high hidden-state entropy?
