# KE-223: Guideline-grounded Bayesian calibration turns raw verification signals into calibrated confidence

**Date**: 2026-04-18
**Source**: DD-774 (GLEAN, Zhang et al. 2026, arXiv 2603.02798)
**Confidence**: Medium-High
**Connects**: H-087, DD-701, DD-702, DD-704, CR#324

## Core Finding

Bayesian logistic regression over guideline-alignment scores provides a lightweight, principled calibration layer that converts raw verification signals into well-calibrated correctness probabilities. This fills the CR#324 "signal calibration" gap — the missing middle between policy compilation (DD-701) and budget allocation (DD-702).

## Evidence

- GLEAN achieves +12% AUROC and 50% Brier score reduction over best baselines on MIMIC-IV clinical diagnosis (3 diseases)
- Expert clinician study validates practical utility of calibrated confidence scores
- Architecture: guideline compilation → step-wise alignment scoring → Bayesian logistic regression → active (uncertainty-triggered) verification

## Mechanism / Why

Raw verification signals (pass/fail, score vectors) are noisy and uncalibrated — a score of 0.7 doesn't mean 70% chance of correctness. By accumulating guideline-alignment features along a trajectory and fitting a Bayesian logistic model, you get: (1) well-calibrated probabilities with uncertainty estimates, (2) a principled basis for active verification — spend more resources on uncertain cases, and (3) domain-grounded interpretability — confidence is traceable to specific guideline violations.

## Implications

### 1. CR#324 stack now has all four layers
DD-701 (policy DSL) → DD-774/GLEAN (calibration) → DD-702 (budget allocation) → DD-703 (runtime enforcement). The calibration layer was the missing piece that H-087 predicted.

### 2. Active verification is uncertainty-driven budget allocation
GLEAN's "expand guideline coverage for uncertain cases" is the verification-side analog of DOVA's compute budget allocation — both allocate resources based on estimated difficulty/uncertainty.

### 3. Binary pass/fail verification leaves value on the table
Our current verification signals are mostly binary. Calibrated continuous confidence would let orchestrator/coach make graded decisions (e.g., "87% confident this is correct, skip re-verification" vs "42% confident, invest more checks").

## Actionable

- Design a calibration layer for our verification pipeline: accumulate per-step guideline-alignment features, fit lightweight Bayesian model to map them to calibrated confidence
- Coach/orchestrator should consume calibrated probabilities, not binary pass/fail, for routing and resource allocation decisions
- Cold-start problem: we need curated evaluation guidelines per task type before calibration can work — start with verification and code-review tasks where we have the most data

## Open Questions

- Does the Bayesian calibration generalize across domains, or is it specific to structured clinical protocols?
- What's the minimum number of labeled examples needed to fit the calibration model reliably?
- Can we bootstrap guidelines from our existing skill/policy files rather than manual expert curation?
