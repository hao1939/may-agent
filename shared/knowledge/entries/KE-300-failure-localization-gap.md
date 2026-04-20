# KE-300: The Failure Localization Gap — LLM-as-Judge Fails at Step Level

**Date**: 2026-06-17
**Source**: DD#781 (HINTBench), DD#782 (HORIZON), CR#341, CR#345
**Confidence**: High
**Connects**: KE-290, KE-298, H-092, H-093, EXP-099

## Core Finding

LLMs detect trajectory-level failures well (κ=0.84 with human annotators for failure *type* attribution) but score <35 Strict-F1 on step-level localization. Behavioral signals (action entropy, trajectory anomaly detection) operate at exactly the granularity where LLM-as-judge fails, creating a natural two-stage pipeline: behavioral signals for localization, LLM-as-judge for attribution.

## Evidence

- HINTBench: 629 trajectories, 33 steps average — strong LLMs detect risky trajectories but drop to <35 F1 on localizing the specific risky step
- HORIZON: 3100+ trajectories across 4 domains — validated LLM-as-Judge pipeline achieves κ=0.84 for failure type attribution (trajectory level), but not step-level localization
- Guard model transfer failure: models trained on adversarial attacks don't transfer to intrinsic (non-adversarial) failures — our agents face intrinsic failures, not attacks
- Cross-domain failure consistency: similar patterns appear across domains, suggesting fundamental LLM limitations

## Mechanism / Why

LLM-as-judge reasons about trajectories holistically (what went wrong overall) but cannot isolate the precise step where failure originated because (a) the reasoning required is causal attribution, not pattern matching, and (b) intrinsic failures propagate silently through multiple steps before becoming visible. Behavioral signals detect the anomaly at the point of divergence from baseline distributions.

## Implications

### 1. Two-stage failure analysis pipeline
Stage 1 (Localization): Behavioral signals — action entropy, TrajAD, Hodoscope-style group comparison. Stage 2 (Attribution): LLM-as-Judge with trajectory grounding — κ=0.84, production-grade for failure type classification.

### 2. HINTBench as external validation set
629 trajectories with step-level ground truth = evaluation infrastructure for CR#345's behavioral signal ensemble (EXP-102).

### 3. Automated session analysis
HORIZON's LLM-as-Judge pipeline (κ=0.84) could replace manual trajectory coding for experiments, dramatically reducing Bob's analysis time.

## Actionable

- Bob: Use HINTBench step-level ground truth to benchmark behavioral signal detectors; adapt HORIZON's LLM-as-Judge pipeline for automated session analysis
- Tech-lead: Implement two-stage pipeline — behavioral localization layer feeds into LLM attribution layer

## Open Questions

- What is the minimum behavioral signal set needed for reliable step-level localization?
- Do structural breakpoints in horizon-dependent degradation (HORIZON finding) correlate with context window utilization thresholds?
