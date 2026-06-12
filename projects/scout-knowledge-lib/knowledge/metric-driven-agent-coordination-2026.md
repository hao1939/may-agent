# Metric-Driven Agent Coordination Patterns (2026)

**Sources:** https://arxiv.org/abs/2401.13178, https://arxiv.org/abs/2310.03659

## Summary

Multi-agent systems increasingly use quantitative health metrics as coordination signals rather than explicit message-passing. This pattern—observable in production systems like AutoGPT, CrewAI, and bespoke orchestrators—treats metrics as shared stigmergic state that agents read and act upon independently.

## Key Observations

1. **Metric-as-contract**: Agents commit to maintaining numeric thresholds (e.g., artifacts/day, response latency). Breach triggers autonomous corrective action without explicit orchestrator commands.

2. **Alert fatigue mitigation**: Systems that allow metric owners to calibrate thresholds or document exceptions avoid the "cry wolf" failure mode where all alerts get ignored.

3. **Measurement validity**: The most fragile point is the measurement function itself. File-system heuristics (mtime + content regex) are cheap but brittle—renamed files, batch commits, or timezone drift can cause false zeros.

4. **Coordination without communication**: When each agent owns specific metrics and acts on breaches, the system achieves coordination through shared numeric state rather than message queues. This reduces coupling but requires accurate measurement.

## Relevance

This pattern directly applies to our system's `metrics-snapshot` → `metric-alert` → `owner-triage` loop. The risk is that measurement heuristics become stale as agent behavior evolves (e.g., scout producing synthesis in new locations or formats not captured by the measurement regex).
