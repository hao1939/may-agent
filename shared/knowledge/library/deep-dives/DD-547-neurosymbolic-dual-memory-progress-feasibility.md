# DD#547: Neuro-Symbolic Dual Memory — Neural Progress + Symbolic Feasibility Verification

**Date:** 2026-04-06
**Paper:** arXiv:2604.02734 — "Aligning Progress and Feasibility: A Neuro-Symbolic Dual Memory Framework for Long-Horizon LLM Agents"
**Rating:** ★★★★ HIGH

## Key Finding

Framework that decouples two failure modes of long-horizon agents — Progress Drift (global) and Feasibility Violations (local) — assigning each to the appropriate computational paradigm. Neural memory handles fuzzy semantic progress tracking; symbolic memory (executable Python verification functions) handles strict action feasibility checking. ALFWorld: 58.2% → 87.3% success, 38.1% → 8.4% invalid actions.

## Core Architecture

### Two Failure Modes, Two Paradigms

1. **Progress Drift** (global): Agent loses track of position in task. Requires fuzzy semantic reasoning → **neural memory** (retrieved blueprints with progress anchors)
2. **Feasibility Violations** (local): Agent attempts impossible actions. Requires strict constraint checking → **symbolic memory** (executable Python verification functions)

### Offline Phase
- **Feasibility Memory**: Induce Python verification rules from success/failure transitions. Zero false-rejection tolerance — better to miss some invalid actions than block valid ones.
- **Progress Memory**: Distill successful trajectories into progress anchors + action chunks. Two-level semantic index for retrieval.

### Inference Phase
At each step: (1) Progress guidance retrieves matching action chunk → generate candidate action, (2) Symbolic feasibility check against all rules → if fail, return error + correction suggestion → regenerate, (3) Progress monitor evaluates anchor completion.

## Key Results

| Method | ALFWorld | WebShop | TextCraft |
|---|---|---|---|
| ReAct baseline | 58.2% | 32.0% | 18.0% |
| This method | **87.3%** | **47.0%** | **42.0%** |

Ablation: Progress Memory contributes more to success rate; Feasibility Memory contributes more to reducing invalid actions and trajectory length. Complementary, not redundant.

## Why This Matters

- **Cleanest validation** that different failure modes need different computational paradigms
- **Executable Python functions** as symbolic representation: runnable, explainable, corrective, composable
- **Independently confirms CR#295 thesis**: verification and experience are the two scaling axes for agent systems

## Connections

- DD#545 (APEX-EM): Provides the complementary verification axis to APEX-EM's experience axis
- DD#540 (Steve-Evolving): Skills = Progress Memory, Guardrails = Feasibility Memory — same pattern discovered empirically
- DD#528 (SEVerA): FGGM contracts ≈ Feasibility Memory rules; Python functions are more practical variant
- DD#539 (MemCoder): Text-based failure descriptions → executable Python functions is strictly more powerful
- CR#295 (Verification × Experience): This paper literally separates these two axes into distinct subsystems

## Predictions

- P311: Executable verification function pattern becomes standard in production agent systems within 12 months
- P313: Neuro-symbolic split adopted for multi-agent: Planning Agent (neural progress) + Verification Agent (symbolic feasibility)

**Seeds KE-088.**
