# KE-304: ErrorProbe — Self-Improving Multi-Agent Error Diagnosis via Verified Episodic Memory

**Date**: 2026-06-18
**Source**: DD#812 (arxiv 2604.17658, Li et al., ACL 2026 Findings)
**Confidence**: High
**Connects**: KE-300, DD#782, DD#814, CR#346

## Core Finding

Multi-agent system failures can be diagnosed without expert annotation through a three-stage pipeline: failure taxonomy classification → symptom-driven backward tracing → multi-agent validation with tool-grounded execution. A verified episodic memory that updates only on confirmed error patterns enables cross-domain transfer without retraining.

## Evidence

- Evaluated on TracerTraj and Who&When benchmarks
- Significantly outperforms baselines on step-level error localization
- Backward tracing prunes irrelevant context, focusing on the causal chain from observed failure
- Verified memory enables robust cross-domain transfer — patterns learned in one domain apply to others
- Three-agent diagnostic team (Strategist/Investigator/Arbiter) validates hypotheses through executable evidence

## Mechanism / Why

Long multi-agent interaction traces create a needle-in-haystack problem for error diagnosis. LLM-as-judge approaches fail because they can't reliably pinpoint the decisive error step in extended contexts. Backward tracing from symptoms narrows the search space; tool-grounded validation ensures only confirmed patterns enter memory.

## Implications

### 1. Rejection ≠ recovery (connects DD#814)
Error *diagnosis* is fundamentally different from error *correction*. You need distinct mechanisms for each — a system that catches errors well may still fail at fixing them.

### 2. Extends verification pipeline to runtime diagnosis
CR#346's verification macro-thread gains a runtime component: not just static checking of outputs but dynamic diagnosis of failure chains across agent interactions.

### 3. Verified memory > raw memory
Memory that updates only on tool-confirmed patterns avoids the confabulation risk of unchecked episodic memory. Design principle: gate memory writes on executable evidence.

## Actionable

- Tech-lead: Consider backward-tracing diagnosis for multi-agent workflow failures — trace from observed symptom to root cause agent/step
- System design: Memory systems should require verification gates before committing new patterns

## Open Questions

- What if the diagnostic tools themselves are unreliable?
- Coordination overhead of the three-agent diagnostic team — is it worth it for simpler systems?
