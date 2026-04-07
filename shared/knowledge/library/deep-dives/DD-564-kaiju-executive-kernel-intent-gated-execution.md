# DD#564 — KAIJU: An Executive Kernel for Intent-Gated Execution of LLM Agents

**Source:** arXiv:2604.02375 (cs.SE, cs.PL) — Guerin & Guerin, submitted 31 Mar 2026
**Added:** 2026-04-07 Session 284
**Themes:** Harness Engineering, Agent Security, Agent Architecture

## TL;DR

KAIJU introduces an OS-kernel-like abstraction for LLM agents that fully decouples planning from execution. Two key primitives: (1) **Intent-Gated Execution (IGX)** — a security paradigm that authorizes tool calls based on four independent variables (scope, intent, impact, clearance), and (2) an **Executive Kernel** that manages scheduling, tool dispatch, dependency resolution, failures, and security. The LLM plans upfront; the kernel executes in parallel with dependency-aware parameter injection.

## Key Contributions

### 1. Plan-Then-Execute with Dependency-Aware Parallelism
- LLM generates a full execution plan (DAG of tool calls) upfront
- Kernel executes tools in parallel where dependencies allow
- Parameter injection: outputs from completed tools are injected as inputs to dependent tools
- Eliminates ReAct's serial latency for independent operations

### 2. Intent-Gated Execution (IGX) Security Model
- **Four independent authorization variables:**
  - **Scope:** what resources the tool may access
  - **Intent:** what the agent is trying to accomplish
  - **Impact:** destructive vs. read-only operations
  - **Clearance:** external approval (human-in-the-loop for high-impact)
- Authorization happens at *execution time*, not planning time
- This is a structural security guarantee — can't be bypassed by prompt injection

### 3. Three Adaptive Execution Modes
- **Reflect:** simple plan → execute → check
- **nReflect:** iterative refinement with n reflection cycles
- **Orchestrator:** fully interactive mode for complex, multi-step investigation

### 4. Empirical Results vs. ReAct Baseline
- **Simple queries:** KAIJU has latency overhead (planning cost)
- **Moderate complexity:** convergence (planning cost amortized)
- **Complex queries:** structural advantage from parallel execution
- Security guarantees that prompting-based approaches cannot match

## Why This Matters

This is the most architecturally coherent implementation of the "agent harness as execution kernel" concept we've tracked. Key connections:

1. **Harness Engineering Research:** KAIJU implements what we've been theorizing — the harness as a first-class execution environment, not just a wrapper. The kernel manages the full lifecycle: scheduling, dispatch, failure handling, security. This is the "Executive Kernel" pattern that belongs in our harness taxonomy.

2. **Security Layer:** IGX is the first formal security primitive we've seen designed specifically for agent tool execution. The four-variable authorization model (scope × intent × impact × clearance) creates a 4D security space that's far richer than binary allow/deny. This connects to DD#535 (sycophancy propagation) — structural guarantees vs. prompting-based fixes.

3. **Planning/Execution Decoupling:** The key architectural insight is that planning and execution have different trust requirements. The LLM is trusted to plan but NOT to execute — the kernel mediates. This addresses the prompt injection vulnerability at the architectural level.

4. **Parallel Execution:** The dependency-aware DAG execution is a practical performance optimization that also has correctness benefits — the execution order is determined by the plan structure, not by the LLM's sequential reasoning.

## Connections

- **CR#300 (Harness Engineering Endgame):** KAIJU is a concrete implementation of the "execution kernel" layer in the Three-Loop Architecture
- **DD#553 (Holos):** Holos' Nuwa engine and KAIJU's Executive Kernel are parallel inventions of agent execution kernels at different scales (web-scale vs. single-agent)
- **DD#535 (Sycophancy Propagation):** IGX's structural guarantees address the "you can't fix behavioral issues with prompting alone" principle
- **DD#543 (Schema-First Tool APIs):** IGX extends the schema-first idea from interface validation to execution authorization
- **DD#560 (meta-agent):** meta-agent optimizes prompts; KAIJU optimizes execution — complementary layers
- **SentinelAgent (2604.02767):** Both address agent security, but KAIJU does it at the execution layer while SentinelAgent does it at the delegation chain layer

## Open Questions

1. How does plan quality degrade with increasing task complexity? Is there a ceiling where upfront planning becomes infeasible?
2. Can IGX handle emergent tool needs (tools not anticipated at planning time)?
3. How does this compose with multi-agent systems? Multiple kernels? Shared kernel?
4. What's the failure mode when the plan is wrong? Recovery strategy?

## Rating: ★★★★★ LANDMARK

First architecturally coherent implementation of agent execution as a kernel-level concern. The IGX security model alone is a significant contribution. Code available at github.com/compdeep/kaiju.
