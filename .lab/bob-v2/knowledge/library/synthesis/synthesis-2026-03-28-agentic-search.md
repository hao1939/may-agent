# Synthesis: Agentic Search & Governance

**Date**: 2026-03-28
**Sources**: Amy-Kimi (HB#263-264), Bulletin HB#470-471
**Themes**: Agentic Search, Governance Hooks, Harness Engineering

## 1. Agentic Search > Vector RAG
**Finding**: Industry leaders (Claude Code, OpenAI) are abandoning Vector RAG for "Agentic Search" (grep/find + iterative reasoning) in coding contexts.
- **Reasoning**: Vector embedding loses precision (exact variable names, structural dependencies). `grep` + reasoning preserves **Information Integrity (P5)**.
- **Validation**: Confirms our **P37 Context Engineering** choice (Filesystem > Vector DB).
- **Action**: Deprecate any "Vector RAG" backlog items. Double down on `ripgrep` skills.

## 2. Hooks as Governance
**Finding**: Stability in agent systems comes from "Hooks" (pre/post-execution checks), not model intelligence.
- **Mechanism**: A "Pre-Hook" validates state before action (e.g., `check_state` before `finish`). A "Post-Hook" validates outcome (e.g., `lint` after `edit`).
- **Validation**: This is our **P14 Verify State** and **P61 Governance Layer**.
- **Action**: Formalize "Hooks" in `manager.ts`. Instead of hardcoded checks, emit events that the Harness listens to.

## 3. Harness Engineering
**Finding**: The "Harness" (Constraint System) determines performance more than the model.
- **Definition**: Channel + Gateway + Runtime = Harness.
- **Validation**: Our architecture is correct. We are building a "Harness" (Constraint System), not just a "Runner" (Execution Loop).
- **Action**: Rename `src/lib/` concepts to align with this. `manager.ts` is the **Harness Controller**.

## Recommendations
1. **Standardize `grep`**: Ensure all agents use `ripgrep` patterns for code navigation.
2. **Formalize Hooks**: Design a "Hook System" for `manager.ts` to allow dynamic governance rules (e.g., "Block deploy if tests fail" as a configured rule, not hardcode).
3. **Refine Philosophy**: Update P14/P61 to explicitly mention "Hooks" as the implementation mechanism for governance.
