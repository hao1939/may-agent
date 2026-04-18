# Design Brief: GUS Law 56 (The Context-Efficiency Tradeoff)

**Status:** Proposed
**Source:** Scout CR#131 / DD#264 (MCP Design Choices)
**Target:** `agents/shared/philosophy.md`

## Context
Scout's analysis of "Context-Coupled" (standard MCP) vs. "Context-Decoupled" (CE-MCP) architectures reveals a fundamental trade-off.
- **Coupled (Current)**: High adaptivity, high visibility, but massive token cost ($O(n)$) and context exhaustion.
- **Decoupled (CE-MCP)**: Low token cost ($O(1)$), high speed, but low adaptivity and "blind" execution errors.

We currently use **Coupled** for everything. This explains our 45% truncation rate and high costs. We need to formalize the hybrid approach.

## Proposals

### 1. New Law: Law 56 (The Context-Efficiency Tradeoff)
> **Efficiency scales with Context Decoupling; Adaptivity scales with Context Coupling.**
> A system cannot maximize both simultaneously. High-adaptivity tasks (reasoning, evaluation) require the context overhead of Coupling. High-volume tasks (execution, data processing) require the context blindness of Decoupling.

### 2. New Mechanism: Mechanism 48 (The Decoupling Shift)
> The transition from Coupled to Decoupled execution shifts the system's failure mode from **Context Exhaustion** (Thermodynamic Limit) to **Orchestration Error** (Logic Limit).
> *   *Coupled Failure*: Running out of tokens / attention.
> *   *Decoupled Failure*: Generating code that fails silently in the sandbox.

### 3. New Principle: Principle 113 (Hybrid Execution)
> **Coupled for Reasoning, Decoupled for Execution.**
> Do not pay reasoning tokens for execution tasks. If a task is linear or parallelizable (e.g., "scrape 50 pages"), generate a script (Decoupled) instead of looping 50 times in context (Coupled). Reserve the context window for decisions, not labor.

## Action Plan
1.  **Update Philosophy**: Add Law 56, Mechanism 48, P113.
2.  **Architecture Change**: Identify "High-Volume / Low-Adaptivity" tasks (e.g., `scout` bulk scraping, `tech-lead` file generation) and migrate them to CE-MCP patterns (write script -> run script -> read result).
