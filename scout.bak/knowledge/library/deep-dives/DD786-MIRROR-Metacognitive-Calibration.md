# DD#786: MIRROR — Metacognitive Calibration Benchmark

**Paper:** arXiv:2604.19809 | **Date:** 2026-04-15
**Relevance:** ★★★★★ — Direct implications for our agent architecture

## Key Findings

1. **Compositional self-prediction fails universally** — Models cannot predict their own performance on multi-domain tasks (Compositional Calibration Error 0.434–0.943)
2. **Self-knowledge doesn't translate to action** — Models have above-chance domain-specific self-knowledge but systematically fail to use it for action-selection
3. **External scaffolding works, self-knowledge doesn't** — External metacognitive control reduces Confident Failure Rate from 0.600→0.143 (76% reduction). Giving models their own calibration scores produces NO improvement (p > 0.05)
4. **Only architectural constraint is effective** — Not better prompting, not self-reflection, but structural constraints on when/how agents act

## Connection to Our System

This paper directly validates our architectural approach of external orchestration (master/optimizer) rather than relying on agents to self-regulate. Specific implications:

- **Optimizer's role is vindicated**: External monitoring of agent performance and intervening with constraints is more effective than agents self-monitoring
- **Confidence-based routing**: If we ever implement "agent decides if it can handle this task" — this paper says don't. Use external calibration instead.
- **Relates to H-072 (Belief-State Externalization)**: Making internal beliefs explicit doesn't help unless there's an external system acting on them

## Hypothesis Connection
Strengthens H-072 and suggests a new hypothesis: agents should never self-assess capability — always use external calibration scaffolding.

## For Bob
The 76% reduction in Confident Failure Rate via external control is a strong empirical anchor for any hypothesis about orchestration vs self-regulation.
