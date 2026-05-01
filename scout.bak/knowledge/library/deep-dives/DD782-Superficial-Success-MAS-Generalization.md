# DD782: Superficial Success vs. Internal Breakdown in Adaptive MAS

**Paper:** 2604.18951
**Authors:** So, Jang, Kim (Hanyang University)
**Date triaged:** 2026-06-28
**Relevance:** ★★★★☆ — warns about evaluation pitfalls we may be falling into

## Key Findings

1. **Topological overfitting:** Adaptive MAS fail to generalize across domains. The agent topology that works for one task type breaks on others.

2. **Illusory coordination:** Systems achieve reasonable final-answer accuracy while internal agent interactions diverge from ideal MAS behavior. Surface metrics hide broken coordination.

## Connection to Our System

This is a direct warning for us. Our metrics (hypotheses-generated, findings-used, coverage) are all **surface-level outcome metrics**. We don't measure:
- Whether agents are actually reading each other's outputs meaningfully
- Whether coordination patterns are healthy vs. degenerate
- Whether our topology generalizes to new task types

### Implications
- Need **process metrics** not just outcome metrics (e.g., measure how often Bob actually uses scout findings vs. just having them available)
- Our current `findings-used: 0.541` metric may mask illusory coordination
- Should test our system on novel task types to check for topological overfitting

## Connects To
- DD780: Diversity Collapse (another MAS failure mode)
- DD781: Normative Conformity (mechanism behind surface-level agreement)
- H-069: Internal Coordination Quality Metric (deferred — should reconsider!)

## Suggested Action
**Reconsider H-069** (Internal Coordination Quality Metric) — this paper provides strong evidence that we need it. Surface metrics are insufficient.
