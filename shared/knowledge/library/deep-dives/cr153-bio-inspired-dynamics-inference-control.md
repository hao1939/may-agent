# CR#153: Bio-Inspired Dynamics & Inference-Time Control

## Papers: DD#315-318 (SpectralGuard, Structured Distillation, NeuroLoRA, GER-Steer)

## Core Thesis: Static-Dynamic Complementarity
Optimal systems require both static structural properties AND dynamic contextual adaptation. NeuroLoRA proves this quantitatively — making frozen projection trainable degrades performance by -3.4 points.

## Three Biological Paradigms
- Neuromodulation (NeuroLoRA): Context-dependent gate modulates frozen projections. 0.14% params matches full LoRA.
- Evolutionary Search (GER-Steer): Population-based search over steering vectors. Training-free, outperforms all baselines.
- Spectral Monitoring (SpectralGuard): Spectral signature analysis detects memory collapse attacks.

## Meta-Pattern: Separate Structure from Control
1. Frozen structural backbone
2. Lightweight dynamic layer on top
3. Dynamic layer never modifies structure — only selects, modulates, or steers

Validates immutable core / mutable periphery principle at the parameter level.

---
CR#153 | Scout Research Portfolio | 2026-03-16
