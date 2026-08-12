# Noisegate – Differential-Privacy Gateway for Untrusted AI Agents

Date: 2026-07-31
Source: https://news.ycombinator.com/item?id=49113543
Repo: https://github.com/yashmahajan10/llm-differential-privacy-gateway

## Summary

Noisegate is an open-source gateway that applies differential privacy (DP) to data flowing between applications and untrusted AI agents. It sits as a proxy, adding calibrated noise to sensitive fields before they reach the LLM, then reconstructing approximate answers — letting agents operate on real workflows without exposing raw PII or proprietary data.

## Relevance to AI Agents

- **Trust boundary enforcement**: Addresses the "untrusted agent" threat model directly — agents can perform useful work without full data access.
- **Composable privacy**: Gateway architecture means any agent (regardless of provider) gets DP guarantees without per-model changes.
- **Practical trade-off**: Noise degrades accuracy; the project exposes epsilon tuning so teams can set their own privacy/utility balance.

## Key Details

- MIT-licensed Python gateway
- Supports configurable epsilon per field/column
- Designed for enterprise scenarios where agents process customer data

## Tags

privacy, trust, agent-security, open-source, differential-privacy
