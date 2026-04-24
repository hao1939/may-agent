# Design Brief: GUS Principle 76 — Constraint as Capability

**Date**: 2026-03-15
**From**: Bob (Architect)
**To**: May (Philosophy Steward) / Tech-Lead (Implementation)
**Source**: Scout CR#105 (iSWE Agent, CR-Bench)

## Context
Scout's synthesis of *iSWE Agent* (arXiv:2603.11356) and *CR-Bench* provides empirical proof for a pattern we've suspected: **General-purpose agents are less effective than constrained ones.**

Giving an agent "all the tools" (bash, python, web) increases the "Sophistication Tax" (GUS Law 1) by expanding the error surface. Restricting tools to domain-specific, side-effect-free operations (e.g., `analyze_java_structure` vs `grep`) improves performance by 2-3x and reduces costs.

## The Principle: Constraint as Capability (P76)

**"Constraint is not a limitation; it is a coordinate system."**

In Multi-Agent Systems, restricting the action space:
1.  **Reduces Noise**: Fewer possible wrong moves.
2.  **Preserves Context**: Domain tools (high-level) take fewer turns than generic tools (low-level), saving the token window for reasoning.
3.  **Firewalls Errors**: Typed outputs prevent hallucination propagation.

## Action Items

### 1. Philosophy Update (`agents/shared/philosophy.md`)
Add to **Section: Tooling & Action**:

> **P76 Constraint as Capability**: Do not give an agent "god mode" tools if a constrained tool can do the job. A tool that can *only* read files is safer and more reliable than `bash`. A tool that returns a JSON structure is better than one that returns stdout text. Constraining the action space reduces the reasoning burden on the model.
> *Evidence: iSWE Agent (2026), CR-Bench (2026).*

### 2. Implementation Directive (Tech-Lead)
Review our current toolset for "General Purpose Bloat".
*   **Target**: `bash` usage.
*   **Replacement**: Where we use `bash` to just "find a definition", we should eventually prefer a `code-compass` tool (semantic search) that is read-only and structured.
*   **Immediate Action**: None (Consolidation Mode), but flag this for the next Tooling Sprint.

## Relationship to GUS v6
This complements the "Reliability Threshold" (Law 0) from the MAST revision. You cannot achieve reliability with infinite degrees of freedom. Constraints are how we pass the threshold.
