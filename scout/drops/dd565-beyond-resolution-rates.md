# DD#565 — Beyond Resolution Rates: Behavioral Drivers of Coding Agents

**Date**: 2026-04-07 (Session 284)
**Source**: [arXiv 2604.02547](https://arxiv.org/abs/2604.02547) — Cognition AI Labs (cs.SE, April 2026)
**Rating**: ★★★★★ LANDMARK — Largest coding agent empirical study ever conducted

---

## Summary

The most comprehensive empirical study of coding agent behavior: **9,374 trajectories** from **19 agents** (8 frameworks × 14 LLMs) across **500 tasks** from SWE-bench Verified.

### Three Paradigm-Shifting Findings

**1. Unsolvable Easy Tasks**: 12 tasks rated "easy" by humans are NEVER solved by ANY of the 19 agents. The bottleneck isn't coding ability — it's architectural reasoning (understanding build systems, dependency chains, module boundaries). This reveals a fundamental ceiling in current agent capabilities.

**2. Simpson's Paradox in Trajectory Length**: The naive correlation "longer trajectories = failure" is a Simpson's paradox. When controlling for task difficulty, the relationship REVERSES: agents that spend more time gathering context before editing have HIGHER success rates. The "fail fast" intuition is wrong for coding agents. Context-gathering predicts success.

**3. LLM Primacy, Framework Diminishment**: The LLM is the primary driver of task outcomes. Framework influence is measurable but diminishes with each LLM generation. As LLMs improve, the framework matters less for the reasoning layer. This is the "framework primacy" question answered empirically.

---

## Why This Matters

This paper resolves a central tension in harness engineering: **should we invest in better frameworks or better models?**

The answer is nuanced:
- **Reasoning layer**: LLM dominates. Framework prompts have diminishing returns. Don't over-engineer the inner loop.
- **Execution layer**: Framework still matters. Security, scheduling, parallelism (DD#564 KAIJU) provide durable value that doesn't diminish with better LLMs.
- **Input layer**: Neither LLM nor framework can fix bad inputs (DD#566, CR#297).

The context-gathering finding directly validates our proposed "context-first enforcement" harness pattern — requiring information-gathering before editing improves outcomes empirically.

---

## Connections

- **CR#300** (Harness Engineering Endgame): Empirically validates that framework investment should target execution infrastructure, not reasoning prompts
- **DD#564** (KAIJU): Builds exactly where DD#565 says framework value concentrates — the execution layer
- **DD#541** (Thinking Depth Regression): Read:Edit ratio concept aligns with context-gathering finding — more reading = better outcomes
- **CR#293** (Reasoning Depth Quality): "Every thinking token saves 10-100× correction tokens" — DD#565 provides the statistical proof
- **DD#566** (HTTP Behavioral Signatures): Agent documentation consumption patterns extend the context-gathering finding to external information sources

---

## Novel Concepts

- **Unsolvable Easy Tasks**: Architectural reasoning ceiling in current agents
- **Simpson's Paradox in Agent Trajectories**: Context-gathering predicts success, not failure
- **Framework Primacy Diminishment**: Framework influence decreases with each LLM generation
- **Behavioral Driver Analysis**: Moving beyond resolution rates to trajectory-level behavioral analysis

---

## Deep Dive

→ [DD-565-beyond-resolution-rates-behavioral-drivers-coding-agents.md](../knowledge/library/deep-dives/DD-565-beyond-resolution-rates-behavioral-drivers-coding-agents.md)
