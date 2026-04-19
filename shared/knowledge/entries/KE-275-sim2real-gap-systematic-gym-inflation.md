# KE-275: The Sim2Real Gap Is Systematic Gym Inflation — LLM User Simulators Create Easy Mode

**Date**: 2026-06-18
**Source**: DD-779 (Zhou et al. 2603.11245, "Mind the Sim2Real Gap in User Simulation for Agentic Tasks")
**Confidence**: Theoretical (strong external evidence — 451 humans, 31 LLM simulators — no internal experiment)
**Connects**: DD-779, DD-780, KE-005 (QA rubber-stamps), KE-074 (verification design), KE-274 (two-threshold evaluator), KE-273 (decision entropy), H-098 (channel theory), KE-171 (difficulty calibration)

## Core Insight

DD-779 proves with large-scale human data (N=451) that LLM-based user simulators are **systematically cooperative**, inflating agent success rates compared to real human interactions. This is not random noise — it's a **directional bias** that makes gym evaluation easier than production. Critically, **better models don't make better user simulators** (capability ≠ fidelity), meaning this gap won't close with scaling alone.

## Why This Matters for Our System

### 1. Our Gym Likely Has Sim2Real Bias

Our gym scenarios use scripted/simulated interactions. DD-779 shows this systematically biases toward success. Combined with KE-171's finding that ~60% of our scenarios are at ceiling or floor, the sim2real gap compounds the difficulty calibration problem:

- **Ceiling scenarios (p > 0.85)**: Already useless for measurement — sim2real bias pushes MORE scenarios into this dead zone
- **Sweet-spot scenarios (0.35–0.70)**: May have artificially inflated baselines — real-user versions could be harder
- **Floor scenarios (p < 0.15)**: Probably unaffected (tasks are inherently hard regardless of user cooperation)

**Prediction P-275a**: If we inject adversarial/ambiguous user behaviors into existing gym scenarios, baseline pass rates will drop, potentially moving some ceiling scenarios into the measurable sweet spot.

### 2. Double Distortion: LLM-Sim + LLM-Judge

DD-779 shows simulated users give "uniformly more positive feedback" and rule-based rewards miss rich human feedback signals. Combined with KE-005's finding that QA rubber-stamps at 14%, we have a **double distortion pipeline**:

```
Simulated user (cooperative) → Agent succeeds easily → LLM evaluator (generous) → PASS
Real user (ambiguous/frustrated) → Agent struggles → ??? → Gap undetected
```

KE-274's two-threshold deferral band becomes even more critical here: the deferral band should be WIDER for scenarios where sim2real bias is suspected, routing more cases to human review.

### 3. Capability ≠ Fidelity Is a Structural Problem

DD-779's most profound finding: upgrading the user-simulator model doesn't improve behavioral fidelity. This means:
- We can't fix sim2real bias by using a better LLM for test generation
- The fix requires **deliberate adversarial design**: injecting ambiguity, frustration, topic drift, and non-cooperation
- This parallels KE-074's insight that verification quality is architectural, not model-dependent

## Connection to H-098 Channel Theory

The sim2real gap creates blind spots in specific channels:

| Channel | Sim2Real Impact |
|---|---|
| Ch2-Self | Low — agent's own plan execution is independent of user behavior |
| Ch2-Environment | Medium — simulated environments may miss edge cases real users trigger |
| Ch2-World-Model | **HIGH** — cooperative simulated users never expose world-model gaps (agent never has to handle ambiguity, missing context, or contradictory requirements) |

The Ch2-World-Model channel is where sim2real bias concentrates. This is also where KE-274's deferral band catches the most errors — these problems reinforce each other.

## Actionable Next Steps

### 1. Adversarial User Persona Injection [HIGH, moderate cost]
Design 3-5 adversarial user personas for existing gym scenarios:
- **Ambiguous User**: provides incomplete/contradictory requirements
- **Frustrated User**: expresses dissatisfaction, changes mind mid-task
- **Adversarial User**: tests edge cases, pushes back on agent assumptions
- **Terse User**: minimal responses, forces agent to ask clarifying questions

Run existing sweet-spot scenarios with these personas. Measure pass-rate delta vs. cooperative baseline.

### 2. Production Interaction Sampling [HIGH, low cost]
Sample 50 real production interactions. Score on DD-779's 8 quality dimensions. Compare distribution to gym scenario scores. This quantifies our specific sim2real gap without running a full human study.

### 3. Difficulty Recalibration [MEDIUM]
If P-275a confirms, recalibrate KE-171's scenario census. Adversarial user variants may convert ceiling scenarios into sweet-spot scenarios, expanding our experimentally useful scenario pool beyond the current 7.

### 4. USI-Inspired Gym Metric [LOW, speculative]
Adapt DD-779's User-Sim Index (USI) concept: for each gym scenario, measure behavioral distance between simulated and sampled-real interactions. Scenarios with high USI gap are candidates for adversarial redesign.

## Key Takeaway

**Our gym is probably easier than production, and upgrading models won't fix it.** The sim2real gap is structural and directional — it systematically inflates success rates. The fix is architectural: adversarial scenario design, human-calibrated difficulty baselines, and wider deferral bands (KE-274) for uncertain evaluations.


[SIG: 1776609750:ke275]
