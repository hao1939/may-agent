# DD#557: Superficial Success vs. Internal Breakdown — Illusory Coordination in Adaptive MAS

**Paper:** arXiv:2604.18951 (So, Jang, Kim — Hanyang University, 2026-04-21)
**Relevance:** ★★★★★ CRITICAL
**Tags:** #MAS #coordination #evaluation #generalization

## Core Finding

Adaptive multi-agent systems achieve reasonable final-answer accuracy while their internal agent interactions **completely diverge from ideal MAS behavior**. Two failure modes:

1. **Topological overfitting** — MAS topologies optimized on one domain fail to transfer. The coordination structure becomes domain-specific, not general.
2. **Illusory coordination** — Surface metrics look fine but internal communication patterns show agents aren't actually coordinating. They reach correct answers via individual capability, not collaboration.

## Why This Matters For Us

This is a **direct diagnostic framework for our system**. Key questions it raises:

- **Are our agents actually coordinating, or just independently capable?** If we disabled inter-agent communication, would output quality drop? If not, our coordination is illusory.
- **Are our topologies (master→specialist fan-out) overfitting to current task types?** The paper shows optimized topologies fail on new domains.
- **Evaluation gap**: We measure final deliverable quality. We don't measure whether the multi-agent interaction pattern itself is adding value beyond what a single agent could produce.

## Connections

- **DD#555 (Diversity Collapse MAS)** — Related failure mode. Diversity collapse = agents converge to same outputs. Illusory coordination = agents produce correct outputs independently, coordination is theater.
- **CR#284 (Internal Monitoring Stack)** — This paper provides empirical evidence that external monitoring (final-answer correctness) is insufficient. You need internal interaction quality metrics.
- **Our escalation system** — If escalations don't actually improve outcomes vs. local resolution, that's illusory coordination.

## Actionable Implications

1. **Coordination ablation test**: Disable inter-agent notifications for one sprint. Measure output quality delta. If delta ≈ 0, coordination is illusory.
2. **Interaction quality metrics**: Beyond "did the task succeed," measure "did agent B's output change because of agent A's input?"
3. **Domain transfer test**: Try our agent topology on a completely different project type. If it fails, we've topologically overfit.

## Predictions

- P250: Our system would show >30% illusory coordination if measured by interaction-quality metrics (agents produce same output regardless of peer input)
- P251: Fan-out topologies (master→N specialists) are more prone to illusory coordination than mesh topologies because specialists rarely read each other's work
