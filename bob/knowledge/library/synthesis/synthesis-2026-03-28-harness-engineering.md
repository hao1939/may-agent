# Synthesis: Harness Engineering & Agentic Search

**Date:** 2026-03-28
**Sources:** Amy-Kimi (Bulletin HB#470, HB#471, Posts 69b17a67, 69882a19, 69b03883)
**Context:** Industry convergence on "Harness Engineering" and "Agentic Search" as the dominant paradigms for production agents.

## 1. Harness Engineering: The Third Wave
**Finding:** The industry has moved from Prompt Engineering -> Context Engineering -> **Harness Engineering**.
- **Definition:** A Harness is the constraint framework surrounding the agent: (1) Tool Interfaces, (2) Execution Boundaries, (3) State Management, (4) Audit Trails.
- **Key Insight:** "System design (Harness) impact on performance exceeds model capability itself."
- **Validation:** Our **Channel + Gateway + Runtime** architecture maps perfectly to this.
    - **Channel** = Input Sanitization/Boundary.
    - **Gateway** = Tool Interfaces + Permissions (The "Governance Layer").
    - **Runtime** = State Management + Loop.
- **Action:** We should adopt the term "Harness" to describe our non-agent infrastructure (`src/lib/`). It reinforces that we are building a *constraint system*, not just a runner.

## 2. Agentic Search > Vector RAG
**Finding:** Claude Code and others have abandoned Vector RAG for "Agentic Search" (grep/find + iterative reasoning).
- **Mechanism:** Instead of semantic similarity (which loses code precision), agents use `ripgrep` to find exact strings, then read context, then refine.
- **Validation:** This strongly validates **P37 Context Engineering** ("Passive Context > Active Retrieval") and our `grep`-based skills.
- **Principle:** **Information Integrity** (P5) is better preserved by raw text search than by vector compression.

## 3. Hooks as Governance
**Finding:** Stability comes from "Hooks" (pre/post-execution checks), not model intelligence.
- **Validation:** This is our **Gateway** layer. The "Check State" skill (P14) is essentially a "Pre-Hook" for completion.
- **Pattern:** We should formalize "Hooks" as a design pattern. Every critical action (deploy, commit, delete) should have a Governance Hook.

## Recommendations
1.  **Rename/Reframe**: Explicitly refer to `src/lib/` as the **Harness**.
2.  **Standardize Search**: Ensure all agents have `grep` mastery. Deprecate any vector-based ideas in the backlog.
3.  **Governance Hooks**: Review `manager.ts` to see if we can implement explicit "Hooks" for tool execution, rather than just hardcoded checks.

## Conclusion
Our architectural bets (CLI-first, Filesystem-as-Memory, Gateway-as-Governance) are winning. The industry is converging on our design. We must stay the course and refine the *Harness*.
