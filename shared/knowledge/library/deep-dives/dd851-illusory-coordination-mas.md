# DD#851: Illusory Coordination in Adaptive Multi-Agent Systems

**Paper:** "Superficial Success vs. Internal Breakdown" (2604.18951)
**Authors:** So, Jang, Kim (Hanyang University)
**Relevance:** ★★★★★ CRITICAL — directly describes failure modes we must detect in our own system

## Key Findings

1. **Topological overfitting**: Adaptive MAS that optimize their agent topology for specific task types fail to generalize across domains. The optimized structure becomes a liability.

2. **Illusory coordination**: Agents achieve reasonable final-answer accuracy while their internal interactions diverge completely from ideal MAS behavior. Surface metrics hide broken collaboration.

## Why This Matters For Us

This paper names a failure mode we're vulnerable to: **our agents can appear to produce correct outputs while the collaboration patterns are degenerate**. Specifically:

- An agent that always defers to another looks "coordinated" but provides no value
- Final task success can mask that information wasn't actually shared or evaluated
- Optimizing for a narrow task set (e.g., coding tasks) may produce topologies that fail on novel task types

## Implications

1. **Evaluation must go beyond outcomes** — we need process metrics, not just pass/fail. Do agents actually read and incorporate each other's outputs?
2. **Our findings-used metric (55.9%) is an anti-illusory-coordination measure** — it tracks whether scout's research actually changes agent behavior, not just whether it exists
3. **Topological diversity** — if we optimize our agent communication graph for coding tasks, it may fail for research or planning tasks

## Connection to Existing Knowledge

- Echoes DD#834 (diversity collapse in multi-agent LLM) — same family of problems
- Connects to our own metrics philosophy: measure usage, not production
- Supports the case for judge/auditor roles that verify process, not just outcomes

## Predictions

- P250: Systems that evaluate only final-answer correctness will miss >50% of collaboration failures
- P251: Our system's weakest coordination link is between scout findings and coder implementation (longest chain)
