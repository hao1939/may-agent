# DD-574: Fully Byzantine-Resilient Distributed Multi-Agent Q-Learning

**Paper:** arXiv:2604.02791 — Lee, Panagou (University of Michigan)
**Rating:** ★★★½
**Date filed:** 2026-04-09
**Seeds:** KE-083

---

## Summary

First distributed multi-agent Q-learning algorithm guaranteeing **almost sure convergence to optimal value functions** under Byzantine edge attacks (compromised communication links). Key innovation: redundancy-based filtering using **two-hop neighbor information** to validate messages while preserving bidirectional information flow.

## Key Results

- **Problem**: N agents learning cooperatively over a communication network with Byzantine edges injecting arbitrary false messages
- **Innovation**: Two-hop validation — each agent receives messages from neighbors AND neighbors-of-neighbors, uses redundancy to filter corruption
- **Guarantee**: Almost sure convergence to optimal Q-values (prior work: only near-optimal or restrictive assumptions)
- **New topological condition**: Graph-theoretic condition with constructive network-building method and polynomial-time verification

## Core Mechanism: Trust Through Redundancy

Instead of trusting direct messages, each agent:
1. Receives from neighbors AND neighbors-of-neighbors (two-hop)
2. Uses path redundancy to cross-validate messages
3. Filters Byzantine-corrupted messages
4. Preserves bidirectional information flow

This maps to multi-agent systems: **cross-verify agent outputs through redundant channels** rather than trusting direct communication.

## Connections

| Connection | Mechanism |
|---|---|
| DD-470 (Deception) | Byzantine edges (corrupted communication) and equivocation (corrupted content) are complementary corruption models — two-hop validates the channel, speech-act analysis validates the content |
| DD-489 (ClawSafety) | Trust-channel vulnerability is a specific Byzantine edge attack — DD-574 provides the defense framework |
| DD-550 (Cover-up) | Byzantine agents (compromised nodes) are the harder problem — DD-574 addresses edges only |
| KE-045 | Two-hop validation = structural defense against sycophancy cascades — cross-check claims through independent paths |
| KE-048 | Connects to L2 (infrastructure security) — communication topology determines robustness |
| DD-472 (MAD-Spear) | Extends adversarial MARL threat model with concrete defense |

## Limitations

- Byzantine edges only, not Byzantine agents (different threat model)
- Cooperative setting only — no competitive/mixed-motive
- Q-learning specific — unclear generalization to policy gradient or actor-critic

## Design Principles for Agent Harnesses

1. **Redundant communication paths**: Multiple channels between agents for cross-validation
2. **Two-hop verification**: Validate inputs against what OTHER agents see from the same source
3. **Topology analysis**: Pre-deployment check of communication graph robustness

---

*Filed by Bob, 2026-04-09. Source: Scout DD#574.*
