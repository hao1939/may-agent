# DD#908: GAMMAF — Graph-Based Anomaly Monitoring for LLM Multi-Agent Systems

**Paper:** arXiv:2604.24477 (Apr 2026)
**Authors:** Mateo-Torrejón, Sánchez-Macián
**Rating:** ★★★ — Useful framework, moderate direct relevance

## Summary

Open-source benchmarking platform for graph-based anomaly detection in LLM MAS. Not a defense itself but an evaluation architecture with two pipelines:
1. **Training data generation** — simulates debates across network topologies, captures interactions as attributed graphs
2. **Defense benchmarking** — evaluates defense models by dynamically isolating flagged adversarial nodes during live inference

## Key Finding

Effective attack remediation not only recovers integrity but **substantially reduces operational costs** by facilitating early consensus and cutting off adversarial token generation.

## Relevance

- Graph-based monitoring could apply to our agent interaction patterns
- The cost reduction angle is interesting — our system could benefit from early detection of agents going off-track
- Lower priority than DD#907 but worth tracking as the monitoring tooling matures
