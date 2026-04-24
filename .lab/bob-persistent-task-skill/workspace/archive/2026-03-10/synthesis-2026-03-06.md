# Cross-Synthesis Brief: Research (Scout) ∩ Community (Amy)
**Date:** 2026-03-06
**Synthesizer:** Bob
**Sources:** Scout (arXiv, GitHub, English Tech) + Amy (XHS, Chinese Tech, Practice)

## Executive Summary
A strong convergence has emerged between the "theoretical frontier" (Scout/Research) and the "practitioner frontier" (Amy/Community). Both signals confirm that **generative capability is commoditized** and the new battleground is **verification, context engineering, and runtime architecture.**

Our current design focus (Phase 2: Hardening) is precisely aligned with this global shift.

---

## 1. The "Verification Crisis" is Universal
**Signal:** Both worlds identify *incorrect verification* (thinking it's done when it's not) as the primary failure mode of agentic systems.

*   **Scout (Research):** The MAST taxonomy identifies "Incorrect Verification" (FM-3.3) as the #1 failure mode for high-capability models. Vibe Code Bench shows a 0.72 correlation between "self-testing" and success.
*   **Amy (Community):** "Self-Verify" is the single biggest score booster (+16.2pp). The "Dual-AI Review" pattern (Worker + Reviewer) is standard practice.
*   **Synthesis:** The "check" is now more valuable than the "generate". A system that generates code without a distinct, adversarial verification step is structurally obsolete.
*   **Implication:** Our **Ralph Loop** (Hard-Gated Exit) is not just a feature; it is the *essential architectural defense* against the primary failure mode of 2026. We must enforce "Acceptance Criteria" before generation begins.

## 2. Context Engineering *Is* The System
**Signal:** The model is just a component; the *harness* (context structure) determines intelligence.

*   **Scout (Research):** Manus engineering blog establishes "KV-cache hit rate" as the production metric. "Stable Prefix" and "Append-Only" are laws of physics for performance.
*   **Amy (Community):** "Context Entropy determines success." "Harness = The Race Car, Model = The Driver." AFS (Agent File System) and "Filesystem as Memory" are the dominant paradigms.
*   **Synthesis:** **Filesystem = Memory.** The debate is over. Vector DBs are for search; filesystems are for *agent cognition*. Structured, file-based context (like `CLAUDE.md`, `SOUL.md`) is the standard for high-performance agents.
*   **Implication:** We should double down on **File-Based Memory**. Continue replacing implicit context (prompts) with explicit files (`.md` docs) that agents read on demand.

## 3. The "Skill Package" Standard
**Signal:** Tools are too raw; "Skills" (Tool + Doc + Pattern) are the new unit of distribution.

*   **Scout (Research):** HuggingFace Skills and the "Agent Skills" repo explosion. Skills are shipping as distributable packages (e.g., "CUDA writing skill").
*   **Amy (Community):** "MCP = Connection, Skills = Methodology." The "Progressive Disclosure" pattern (lazy-loading skills) is the "Golden Rule" of agent engineering.
*   **Synthesis:** We are moving from "giving agents tools" to "installing skills". A skill is not just a function call; it is the *knowledge of how to use it* bundled with the tool.
*   **Implication:** Adopt the **Lazy-Loaded Skill** pattern. Don't dump all tools into the system prompt. Group them into "Skill Packs" (e.g., `xhs-browsing`, `system-design`) that are loaded only when needed.

## 4. The Rise of "Agent Runtimes" (OS Layer)
**Signal:** Scripts are fragile; true agents need a supervision runtime.

*   **Scout (Research):** Jido 2.0 (BEAM/Erlang) proves that agents need supervision trees, fault tolerance, and isolation—capabilities native to operating systems, not Python scripts.
*   **Amy (Community):** "Sandbox is mandatory." "Hooks" for interception are the new firewall. The "Crash Recovery" pattern is essential.
*   **Synthesis:** The industry is realizing that `while(true)` loops in Python/TS are insufficient. Agents need an "OS" layer that handles crashes, restarts, and resource limits *outside* the agent's cognitive loop.
*   **Implication:** Our **Launcher** redesign (supervision, backoff, distinct exit codes) is validated. We are building a primitive "Agent OS". We should continue to move logic out of the agent (cognitive) and into the runtime (infrastructure).

## 5. Adversarial Dynamics > Cooperation
**Signal:** Friendly agents fail; critical agents succeed.

*   **Scout (Research):** MACC paper shows *competition* outperforms cooperation for discovery.
*   **Amy (Community):** "Worker vs Reviewer" pattern. "Human in the loop, not in the code."
*   **Synthesis:** Single-agent optimization has plateaued. The next gain comes from **structural friction**—one agent proposing, another criticizing.
*   **Implication:** Bob's role as "Design Critic" is architecturally sound. We should formalize the **Reviewer Role** in more workflows (e.g., Optimizer should not just "fix" but "propose and defend").

---

## Actionable Recommendations
1.  **Enforce "Verification-First":** No task starts without defined Acceptance Criteria (Ralph Loop).
2.  **Formalize "Skills":** Refactor `tools.ts` into distinct, lazy-loadable Skill definitions with attached documentation.
3.  **Harden the Runtime:** Continue the Launcher evolution. Treat agent crashes as "handled exceptions" in the OS layer.
4.  **Preserve File-Based Memory:** Resist the urge to add complex databases. The filesystem is the correct abstraction for agent context.
