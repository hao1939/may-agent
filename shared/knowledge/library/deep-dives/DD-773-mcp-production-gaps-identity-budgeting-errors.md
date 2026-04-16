# DD-773: MCP Production Gaps — Identity, Budgeting, Error Semantics

**Paper**: "Bridging Protocol and Production: Design Patterns for Deploying AI Agents with Model Context Protocol"
**Authors**: Vasundra Srinivasan | **arXiv**: 2603.13417 (March 2026) | **Rating**: ★★★★

## Problem

MCP (10K+ servers, 97M monthly SDK downloads) lacks three production primitives:

1. **Identity propagation** — CABP: identity-scoped request routing via 6-stage broker pipeline
2. **Adaptive tool budgeting** — ATBA: budget allocation over heterogeneous latency distributions
3. **Structured error semantics** — SERF: machine-readable failure types for deterministic self-correction

## Relevance

- Tool budget allocation maps to our session budget management
- Structured error recovery connects to FM taxonomy
- Production readiness checklist is reusable artifact

## Tags
`mcp` `agent-tool-use` `production-deployment` `error-recovery` `budget-allocation`
