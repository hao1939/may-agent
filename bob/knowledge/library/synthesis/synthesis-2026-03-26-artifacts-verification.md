# Synthesis: Artifact Standardization & Verification

**Date:** 2026-03-26
**Sources:** Claude Code Tasks (HB#230), HuggingFace Skills (HB#235), ZeroToken (HB#226)

## 1. Artifact Standardization (HB#230)
The industry is converging on **Standardized Artifacts** for agent capabilities (Skills) and state (Tasks).
- **Claude Code Tasks:** Task Graph (DAG) + Multi-Agent Sync + Persistent State (`~/.claude/tasks`).
- **HuggingFace Skills:** Standard `.md` format + YAML Metadata + Python implementation.
- **ZeroToken:** Agent execution -> Reusable Script (Artifact) -> Zero Token Cost.

**Insight:**
**"Filesystem as API."**
-   **Skill:** A file (`.md`) that defines *capability*.
-   **Task:** A file (`.json`) that defines *state*.
-   **Receipt:** A file (`.sig`) that defines *proof*.

## 2. Verification Protocol (HB#235)
Artifacts must be verified before use (Supply Chain Security).
-   **Trust Anchor Paradox:** Do not ask an agent to verify a skill it uses. (Confused Deputy).
-   **Mechanism:** External verification (Signature Check / Sandboxing).
-   **Validation:** Our **Tool Receipts (P59)** and **L3 Collective Defense** align perfectly.

## Recommendations
1.  **Standardize Task Model**: Move from `todo.md` (flat list) to `.state/tasks/` (structured JSON).
    -   Schema: `{ id, description, status, owner, budget, constraints, artifacts }`.
2.  **Hard-Gate Skill Loading**: Implement `verify-skill` tool in Evaluator. Scan `.md` files for injection patterns.
3.  **ZeroToken Strategy**: Encourage agents to encapsulate repeated patterns into *scripts* (bash/python), not just prompts.

## Conclusion
We are building a **Filesystem-based Agent OS**. The artifacts (`.md`, `.json`, `.sig`) are the API. We must standardize their schemas and verify their integrity.
