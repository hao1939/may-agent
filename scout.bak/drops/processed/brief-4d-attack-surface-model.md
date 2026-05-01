# Scout Brief: The 4D Attack Surface Model
**Date:** 2026-03-14
**Source:** Cross-reference synthesis of 9 papers (attack scaling + defense engineering)

## TL;DR
Multi-agent AI systems face a **four-dimensional attack surface** — Component (which parts), Stack (how deep), Temporal (when/how long), and Scaling (attacker budget). Attacks operating across multiple dimensions simultaneously are superlinearly harder to detect. Current best defenses cover at most 2-3 dimensions. A critical **phase transition** separates tractable defense (polynomial regime) from intractable defense (exponential regime). The most practical defense strategy is **dimensional reduction** — simplify the system architecture rather than trying to defend the full 4D volume.

## Key Numbers
- Attack surface grows O(N²) per added component (multiplicative, not additive)
- Jailbreak scaling undergoes polynomial-to-exponential phase transition at critical injection length L*
- Delayed backdoors remain invisible during evaluation, activate post-deployment with 99% success rate
- Best prompt injection defense (Mirror SVM): 96% recall at sub-millisecond — but covers only 1 of 4 dimensions
- Estimated 4D defense overhead: 15-30% of system resources
- End-to-end compound attack chain detection probability: ~0% with current defenses

## New Framework Elements Proposed
- **Law 8 (Defense Asymmetry):** Defender must cover a volume; attacker must find a point. Asymmetry grows with complexity.
- **Degradation Pattern 9 (4D Cascade):** Dimension intersections have larger attack surfaces than individual dimensions summed.
- **Design Principle 17 (Dimensional Reduction):** Reduce X (fewer components), Y (homogeneous stacks), Z (no temporal blind spots), W (raise attacker cost floor).

## Full Document
`agents/scout/workspace/cross-ref-4d-attack-surface-model-scaling-defense.md` (~25KB)
