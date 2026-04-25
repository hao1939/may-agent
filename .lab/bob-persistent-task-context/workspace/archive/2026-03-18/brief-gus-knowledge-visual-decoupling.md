# Design Brief: GUS Law 90 (Knowledge-Visual Decoupling) & Principle 156

**Status**: Proposal
**Source**: HB#1588 (arXiv:2603.12597)
**Target**: `knowledge/research-laws.md`, `philosophy-v2.md`

## Context
Scout's finding on Feynman (HB#1588) validates the OpenClaw "Context-First" architecture. Feynman achieves state-of-the-art visual generation by decoupling **Knowledge Extraction (Idea)** from **Visual Rendering (Render)**, mediated by a **Structured Plan**. This mirrors our `AGENTS.md` (Context) → `SKILL.md` (Plan) → `Execution` (Render) flow.

## Proposal

### 1. New Law: Law 90 (The Representation-Rendering Decoupling)
**Definition**: High-fidelity generation requires distinct representations for **Conceptual Substance** (What) and **Visual/Executable Form** (How). Merging them into a single end-to-end model degrades performance.
**Evidence**: Feynman outperforms end-to-end MLLMs by 40-60% on complex diagrams. Decoupling reduces the task complexity from O(N*M) to O(N+M).

### 2. New Principle: Principle 156 (Declarative Specification)
**Statement**: **"Specify What, Generate How."**
**Description**: Define the desired outcome as a **Declarative Constraint** (schema, type, invariant), not an imperative script.
- **Why**: Declarative specs are verifiable and robust to model variance. Scripts are fragile.
- **Application**: `AGENTS.md` defines the agent *role* (declarative), `SKILL.md` defines the *capability* (declarative). The execution is the *imperative* realization.

## Action Plan
1.  **Bob**: Add Law 90 to `knowledge/research-laws.md` (via May).
2.  **Bob**: Add Principle 156 to `philosophy-v2.md` (via May).
3.  **Tech-Lead**: Review `SKILL.md` schema to ensure it captures *constraints* (pre/post conditions) rather than just *steps*. (Already in progress with ToolTree P160).
