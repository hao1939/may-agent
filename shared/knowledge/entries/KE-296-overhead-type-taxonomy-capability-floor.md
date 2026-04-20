# KE-296: Three Overhead Types With Distinct Difficulty Interactions

**Date**: 2026-04-20
**Source**: DD-810 (arXiv:2604.11465, McClendon et al.)
**Confidence**: Medium-High
**Connects**: H-107, H-098, H-165, KE-294, KE-295

## Core Finding

Three overhead types have fundamentally different difficulty interactions:
1. **Capability-extending** (scaffolding, tools, retrieval) — helps most near capability boundary, biggest gains on "easiest" tasks when model is below capability floor
2. **Compliance** (formatting, safety checks, process requirements) — pure cost; H-107's regime
3. **Incidental** (redundant steps, token waste) — always harmful

Below the capability floor (~5% baseline), scaffolding overhead helps most on the easiest tasks (reversed from H-107), because it fixes incidental failures that dominate easy tasks while lacking fundamental capability for hard ones.

## Evidence

- Three-tier scaffolding (summarizer + agent + corrector) on Qwen3-8B / AppWorld
- Difficulty-1 (easiest): +10.5pp (15.8% → 26.3%)
- Overall: +3.5pp (5.4% → 8.9%)
- Gains concentrate on easiest tier, diminish on harder tiers
- At 5.4% baseline, ALL tasks are below H-107's ~50% threshold

## Mechanism / Why

Two-regime model: (1) Below capability floor, most failures are incidental (context loss, repetitive loops) — scaffolding fixes these, helping most on tasks closest to success. (2) Above capability floor, model has base capability — compliance overhead becomes pure cost per H-107.

## Implications

### 1. H-107 applies specifically to compliance overhead above capability floor
The ~50% threshold and overhead-harm prediction are about compliance/process overhead on tasks where the model has sufficient base capability, not about all overhead types.

### 2. H-098 taxonomy connection
Overhead type maps onto attention channels: capability-extending overhead = Ch2 (structural), compliance overhead = Ch1 (surface process). This strengthens the Ch2 > Ch1 finding — Ch2-type overhead actually helps.

### 3. H-165 connection
Production interference (H-165) is specifically about compliance overhead displacing capability — consistent with the taxonomy. Content-first guards are the compliance variant that minimizes displacement.

## Actionable

- Refine H-107 to specify: "compliance overhead harms above capability floor at ~50% threshold"
- When designing interventions, classify overhead type first before predicting effect
- Capability-extending overhead (tools, retrieval, scaffolding) should not be subject to H-107 constraints

## Open Questions

- Where exactly is the capability floor for our agent on our scenarios?
- Does the two-regime model hold with stronger base models (e.g., at 40-60% baseline)?
