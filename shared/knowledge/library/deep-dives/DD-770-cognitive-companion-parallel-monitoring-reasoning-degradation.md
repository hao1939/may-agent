# DD-770: Cognitive Companion — Parallel Monitoring for Reasoning Degradation

**Paper**: "The Cognitive Companion" | **Authors**: Khan & Khan | **arXiv**: 2604.13759 (April 2026) | **Rating**: ★★★★½

## Core Idea

LLM agents suffer reasoning degradation (looping, drift, stuck states) at rates up to 30% on hard tasks. Two parallel monitoring approaches:

1. **LLM-based Companion**: Separate LLM watches outputs. Reduced loop repetition 52-62%, ~11% overhead.
2. **Probe-based Companion**: Classifier on hidden states (layer 28) predicts degradation before it manifests. AUROC 0.840, zero inference overhead.

## Key Findings

- **Task-type dependent**: Helps on loop-prone/open-ended tasks; neutral or negative on structured tasks
- **Scale boundary**: No improvement on 1B-1.5B models even when interventions fire
- **Sub-token monitoring**: Catches problems at hidden-state level before text generation

## Relevance

- Directly maps to FM-3.3 verification collapse (20.3% rate per EXP-099)
- Probe-based approach = what spectral kill switches (DD#669) proposed
- Task-type dependency validates our observation that FM-3.3 hits only certain task types
- Selective activation aligns with "don't stack interventions" (KE-123)

## Tags
`reasoning-degradation` `agent-monitoring` `hidden-state-probes` `verification-collapse` `loop-detection`
