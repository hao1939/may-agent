# DD#854 — HadAgent: Decentralized Agent Serving with Proof-of-Inference Consensus

**Source:** [arXiv:2604.18614](https://arxiv.org/abs/2604.18614) — Jimenez et al. (2026-04-21)  
**Relevance:** Multi-agent coordination, verification, behavioral monitoring  
**Quality Signal:** MEDIUM-HIGH — Novel verification mechanism for distributed agent inference

---

## Summary

HadAgent replaces blockchain Proof-of-Work with Proof-of-Inference (PoI): nodes earn block-creation rights by executing deterministic LLM inference tasks. Includes trust-based behavioral monitoring with automatic escalation.

## Architecture

- **Three-lane block body:** DATA, MODEL, PROOF channels with independent Merkle roots
- **Two-tier trust system:** Trusted nodes get optimistic execution; non-trusted undergo full verification
- **Harness layer:** Heartbeat probes + anomaly detection + automated trust management

## Key Design: Behavioral Monitoring Loop

1. **Heartbeat probes** detect node liveness
2. **Deterministic recomputation** catches inference errors/manipulation
3. **Trust scoring** based on historical behavior auto-promotes/demotes nodes
4. **Isolation** of malicious or unreliable participants

## Implications for Our System

- **Verification through re-execution:** Deterministic re-execution as gold standard
- **Trust tiers for agents:** Trusted agents get faster paths; untrusted face more verification
- **Self-correcting monitoring:** Automated trust management based on behavioral history

## Tags
`verification` `behavioral-monitoring` `distributed-agents` `trust-management` `blockchain`
