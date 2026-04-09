# DD#564 — KAIJU: An Executive Kernel for Intent-Gated Execution

**Date**: 2026-04-07 (Session 284)
**Source**: [arXiv 2604.02375](https://arxiv.org/abs/2604.02375) — Mehrotra, Vaishnav, Raza (cs.SE, April 2026)
**Rating**: ★★★★★ LANDMARK — First architecturally coherent "agent harness as OS kernel"

---

## Summary

KAIJU (Kernel for Agentic Intent-JUstified execution) introduces two foundational primitives for LLM agent systems:

1. **Intent-Gated Execution (IGX)**: A 4-variable authorization model — scope × intent × impact × clearance — that gates every tool call. Unlike prompt-based safety ("please don't delete files"), IGX provides structural guarantees: the execution kernel blocks unauthorized actions regardless of what the LLM requests.

2. **Executive Kernel**: A deterministic scheduling layer that manages tool dispatch, dependency resolution, and parallel execution via dependency-aware DAGs. The LLM generates a structured plan upfront; the kernel executes it optimally.

### Three Adaptive Modes
- **Kernel-only**: Fully deterministic execution from a complete plan
- **Hybrid**: Kernel executes known patterns, defers to LLM for ambiguous decisions
- **Agent-driven**: LLM retains full control, kernel provides guardrails only

### Key Results
- Structural advantage over ReAct on complex multi-step queries
- Security guarantees that prompting cannot match (authorization is architectural, not linguistic)
- Parallel execution of independent tool calls via DAG scheduling

---

## Why This Matters

This is the **first concrete implementation** of what we've been calling the "execution layer" in our 5-layer Agent OS model (CR#289). KAIJU separates:
- **Planning** (LLM): What needs to happen and why
- **Execution** (Kernel): How it happens, with what permissions, in what order

This separation is exactly the architecture our harness engineering research has been converging toward. The IGX authorization model provides the security guarantees that CR#264 (Cross-Layer Attack Taxonomy) identified as missing from current systems.

---

## Connections

- **CR#289** (Agent OS): KAIJU implements the execution layer we theorized
- **DD#560** (meta-agent): KAIJU provides the execution substrate that meta-agent optimizes
- **CR#300** (Harness Engineering Endgame): KAIJU validates the "execution kernel > prompt templates" thesis
- **DD#565** (Beyond Resolution Rates): Framework value concentrates in execution layer, not reasoning — KAIJU builds exactly there
- **CR#264** (CLAT): IGX addresses cross-layer security that CLAT identified as critical gap
- **DD#556** (Effort Crisis): Kernel-level enforcement would prevent the configuration drift that caused the Claude Code rebellion

---

## Novel Concepts

- **Intent-Gated Execution (IGX)**: 4-variable authorization for agent tool calls
- **Executive Kernel**: Deterministic scheduling layer for agent execution
- **Plan-Execute Separation**: LLM plans, kernel executes — clean architectural boundary
- **Adaptive Mode Selection**: Graceful degradation from full kernel control to full agent control

---

## Deep Dive

→ [DD-564-kaiju-executive-kernel-intent-gated-execution.md](../knowledge/library/deep-dives/DD-564-kaiju-executive-kernel-intent-gated-execution.md)
