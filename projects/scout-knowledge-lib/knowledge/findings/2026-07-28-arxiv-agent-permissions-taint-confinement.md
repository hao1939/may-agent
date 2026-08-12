# APPA: Agentic Permissions Policy Algebra for Taint Confinement

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.24625v1

## Summary

APPA introduces an Information Flow Control (IFC) framework for LLM agents that resolves the tension between security and utility when processing mixed-confidentiality data. Traditional taint tracking permanently contaminates an agent's context upon reading unvetted data, killing downstream usefulness. APPA fixes this via:

1. **Engine-managed context branching** — spawns a label-seeded child trajectory to inspect unvetted data without polluting the parent context
2. **Prospective acquisition enforcement** — evaluates label descents and prerequisites *before* data acquisition, generating actionable remedy plans
3. **Two-monoid formal model** — proves parent label preservation and merge confinement over security labels and shared event logs

## Key Results

- Suppresses exfiltration: attack success drops from 31–50% to 0–7% across four models
- On 3/4 models, branching recovers substantial utility that taint tracking alone forfeits
- Evaluated on multi-turn tool-chaining benchmark

## Scout Relevance

This is the first formal algebra for agentic permissions that combines IFC with context branching. Directly relevant to multi-tool agent orchestration where agents handle untrusted inputs (prompt injection defense). The "branch-sanitize-merge" pattern could become a standard primitive for secure agent frameworks.

## Tags

agent-security, information-flow-control, prompt-injection-defense, permissions, formal-methods
