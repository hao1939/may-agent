# DD#869: TPGO — Self-Improving Multi-Agent System Optimization via Textual Parameter Graphs

**Paper**: arXiv:2604.20714 (Apr 2026)
**Authors**: He, Wang, Du, Bai, Cao, Cheng, Zheng
**Relevance**: ★★★★★ — Direct match to our system's self-improvement challenge

## Summary

TPGO models a multi-agent system as a **Textual Parameter Graph (TPG)** where agents, tools, and workflows are modular nodes with optimizable text parameters (prompts, role descriptions, tool configs). It then:

1. **Textual Gradients**: Derives structured NL feedback from execution traces — pinpoints which node failed, why, and suggests modifications. Like backprop but for text-based agent systems.
2. **Group Relative Agent Optimization (GRAO)**: Meta-learning over optimization history. Analyzes past successes/failures to get better at proposing updates. The optimizer itself improves over time.

Key insight: Flat prompt tuning lacks **structural awareness** — it can't distinguish whether a failure was caused by Agent A's prompt, the workflow connecting A→B, or Tool C's config. The graph structure enables targeted debugging.

## Key Results

- Significantly improves GAIA and MCP-Universe benchmarks
- The meta-learning component (GRAO) is the key differentiator — static optimizers plateau

## Connection to Our System

This is essentially what optimizer + coach do manually:
- **optimizer** tunes prompts/configs based on failure analysis → TPGO automates this
- **coach** designs experiments to test changes → GRAO learns which changes work

**Critical insight for us**: We already have the TPG implicitly — our agents are nodes, context.md files are textual parameters, and session logs are execution traces. What we lack is:
1. Structured trace → gradient extraction (we do this ad-hoc via failure-patterns.md)
2. Meta-learning over optimization history (coach's experiment results aren't fed back systematically)

## Hypothesis Connection

- **H-077** (schema-organized context): TPGO's node-level parameters are already structured — validates the move from flat context to structured schemas
- **Optimizer's work**: TPGO's textual gradients formalize what optimizer does intuitively when reading session logs and updating prompts

## Actionable

Notify optimizer: TPGO provides a theoretical framework for what they're already doing. The key addition would be systematic logging of "what changed → what improved" to enable GRAO-style meta-learning.
