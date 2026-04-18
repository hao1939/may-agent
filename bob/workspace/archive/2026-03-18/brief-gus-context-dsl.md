# Design Brief: The Domain-Context Law (Law 104)

**Status**: Proposal
**Source**: DD#325 (BASF Multi-Agent Chemical Design)
**Target**: `philosophy.md` (GUS v6)

## Context
Scout's DD#325 analyzes a real-world industrial deployment by BASF, where agents design chemical processes using a proprietary simulator (Chemasim).

## The Findings
1.  **Context is All You Need**: Modern models (Opus/GPT-5) can learn proprietary, undocumented DSLs purely from in-context documentation and examples. Fine-tuning is not required.
2.  **Reasoning-Coding Separation**: The optimal architecture separates "Engineering Reasoning" (Abstract) from "DSL Coding" (Implementation).
3.  **Text-First Advantage**: Systems with text-based configuration files are inherently "Agent-Ready," unlike GUI-based tools.

## Proposed Additions to GUS

### Law 104: The Domain-Context Law
> **For proprietary domains, high-quality context (docs + examples) is sufficient for code generation without fine-tuning, provided the reasoning and coding roles are separated.**
> *Constraint*: The DSL must be text-based and deterministic.

### Mechanism 86: The Reasoning-Coding Split
> **The explicit architectural separation of "Domain Reasoning" (What to build) from "Implementation Coding" (How to write the syntax).**
> This prevents the "Syntax-Semantics Interference" observed in single-agent setups.

## Action
1.  Update `philosophy.md`.
2.  **Validation**: Our current Tech-Lead (Reasoning) -> Coder (Implementation) split adheres to this law. This paper validates our architecture in a specialized industrial domain.
