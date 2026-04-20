# KE-290: The Behavioral Turn — Trajectory Signals Replace Linguistic Self-Report for Failure Prediction

**Date**: 2026-04-27
**Source**: CR#345, DD#785 (TrajAD), DD#786 (Trajectory Guard), DD#787 (Silent Failures), DD#788 (AgenTracer), DD#789 (AgentFixer), DD#777 (Hodoscope), DD#800 (Subliminal Transfer)
**Confidence**: High
**Connects**: KE-280, KE-281, KE-273, H-098, H-165, H-176, EXP-101

## Core Finding

Linguistic failure prediction (HVR) is fundamentally limited (AUROC 0.535); behavioral trajectory signals — action anomaly detection, entropy monitoring, structural completeness — provide a superior alternative stack with expected AUROC 0.75-0.85.

## Evidence

- **EXP-101**: HVR AUROC = 0.535, 57.5% zero-hedge rate. Agents don't hedge like humans.
- **DD#787**: 60-70% of agent failures are *silent* — agent doesn't know it's failing, so no linguistic signal possible. HVR ceiling ≈ 0.65 even with perfect calibration.
- **DD#785 (TrajAD)**: Trajectory anomaly detection catches structural deviations in action sequences — tool-type-agnostic, catches silent failures.
- **DD#786 (Trajectory Guard)**: Even simple statistical models on tool-call sequences achieve strong failure prediction — production-feasible.
- **DD#777 (Hodoscope)**: Unsupervised group-wise behavioral comparison achieves 6-23× review effort reduction. Discovered unknown benchmarks vulnerabilities. Validates unsupervised → supervised monitoring pipeline.
- **DD#788 (AgenTracer)**: Counterfactual failure attribution identifies *which* agent/step caused failure — diagnosis layer.
- **DD#789 (AgentFixer)**: Systematic fix recommendation from diagnosed failures — remediation layer.
- **DD#800**: Behavioral biases encoded in trajectory dynamics, not surface tokens. Content filtering insufficient — reinforces that monitoring must operate at action-sequence level, not keyword level.

## Mechanism / Why

Agents externalize failure signals through *what they do* (action sequences, tool choices, retry patterns), not *what they say* (hedging, uncertainty language). Three reasons:
1. Silent failures (majority) produce no linguistic signal at all
2. Mixed tool types produce incoherent confidence (KE-280)
3. Trajectory structure encodes behavioral patterns subliminallyeven through distillation (DD#800)

## Implications

### 1. Four-Layer Behavioral Monitoring Stack
Detection (TrajAD) → Silent Failure Detection (structural completeness) → Attribution (AgenTracer) → Remediation (AgentFixer). Each layer addresses a different failure visibility regime.

### 2. Hodoscope-Style Unsupervised Discovery Is the Entry Point
Don't predeclare failure categories. Compare behavioral distributions across successful/failing sessions. Let anomalies surface, then classify.

### 3. H-098 Ch2 Sub-Taxonomy Gets New Observable Signatures
Self/Environment/World-Model Ch2 variants should produce distinct trajectory anomaly patterns (different action entropy profiles, different tool-call distributions). Behavioral signals may discriminate Ch2 subtypes better than linguistic ones.

## Actionable

- **Design EXP-102**: Hodoscope-style group-wise comparison on FM-3.3 session logs. Action n-grams, tool transition matrices, retry sequences. Compare failing vs. successful sessions. Target AUROC > 0.75.
- **Update H-176**: Context-discovery chain should predict trajectory signatures (breadcrumb-seeking = distinctive action pattern).
- **Deprecate HVR as primary metric**: Keep as supplementary but trajectory signals are the primary failure prediction channel.

## Open Questions

- What's the minimum session length for trajectory signals to discriminate? (DD#786 suggests ~5 actions)
- Can trajectory anomaly detection work in real-time (per-action) or only retrospectively?
- How does the behavioral signal stack interact with H-165 content-first guards?
