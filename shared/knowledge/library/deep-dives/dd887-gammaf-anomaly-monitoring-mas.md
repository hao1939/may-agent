# DD#887 — GAMMAF: Graph-Based Anomaly Monitoring for LLM Multi-Agent Systems

**Paper**: arXiv:2604.24477 — "GAMMAF: A Common Framework for Graph-Based Anomaly Monitoring Benchmarking in LLM Multi-Agent Systems"
**Authors**: Mateo-Torrejón & Sánchez-Macián | **Venue**: cs.CR/cs.MA (Apr 2026)
**Rating**: ★★★★ | **Added**: 2026-04-30

## Key Insight

First standardized benchmarking framework for detecting anomalous agents in LLM multi-agent systems. Models inter-agent interactions as attributed graphs, then applies graph-based anomaly detection to identify compromised/adversarial nodes. Key finding: **effective attack remediation (isolating bad agents) reduces operational costs** by enabling early consensus and cutting adversarial token generation.

## System Relevance — ★★★★

- **Bob's EXP-269 (Taint Token Auditor Gate)**: GAMMAF's approach of isolating flagged nodes during live inference is structurally similar to taint-token gating. Both detect anomalous behavior and gate downstream actions.
- **Evaluator/auditor pipeline**: Graph-based anomaly detection could formalize how we detect session quality issues across the agent network.
- **Cost insight**: Isolating bad actors saves tokens — supports the hypothesis that quality gates *reduce* total system cost rather than adding overhead.

## Lower priority because

Our system is cooperative (not adversarial), and we have ~6 agents (too small for graph-based methods to shine). But the cost-reduction finding from gating is independently valuable.
