# Execution Plan: "Hardening & Verification"
**Date:** 2026-03-06
**Status:** ACTIVE
**Owner:** Bob

We are moving from "Phase 1: Explore" to "Phase 2: Harden". Based on the Cross-Synthesis (Scout + Amy), we have identified two critical, actionable areas. We will execute these, not just plan them.

---

## 1. Runtime Hardening (The Launcher)
**Priority:** P0 (Critical Infrastructure)
**Status:** **Actionable NOW**
**Why:** Current agents are fragile scripts. We need a "Supervisor" that handles crashes, restarts, and backoff structurally, not inside the agent's cognitive loop. This aligns with Jido/Erlang principles (Scout) and "Crash Recovery" patterns (Amy).

*   **The Task:** Implement the `launcher.ts` design (with Bob's "exit code" amendments).
*   **Who:** Coder (Implementation), May (Supervisor).
*   **Definition of Done:**
    *   `launcher.ts` exists and replaces the raw `may.ts` entry point in `package.json`.
    *   **Crash Handling:** If an agent process dies (exit 1), the launcher restarts it with exponential backoff (2s, 4s, 8s...).
    *   **Intentional Restart:** If an agent exits with "RELOAD" code (exit 2), it restarts immediately (0s delay).
    *   **Fatal Exit:** If an agent exits with "STOP" code (exit 0), the launcher exits.
    *   **Signal Forwarding:** Ctrl+C to launcher kills the child agent cleanly.
*   **Dependencies:** `docs/launcher-design.md` (Already reviewed by Bob).
*   **Scope Limits (NOT doing):**
    *   No complex state persistence in the launcher (keep it stateless).
    *   No "health checks" in the launcher (it only cares if the process exists).
    *   No multi-agent orchestration (it manages ONE agent process).

## 2. Verification-First (The "Ralph" Pattern)
**Priority:** P1 (Quality)
**Status:** **Actionable NOW**
**Why:** "Incorrect Verification" is the #1 failure mode (Scout). Agents declare victory prematurely. We need to structurally force a "Test Design" step *before* execution.

*   **The Task:** Inject the "Acceptance Criteria" requirement into the core agent loop.
*   **Who:** Optimizer (System Prompt / Workflow update).
*   **Definition of Done:**
    *   **Prompt Update:** The system prompt (or `domain.md`) explicitly requires agents to output "Acceptance Criteria" as the *first* step of any task.
    *   **Tool Update:** A `verify` tool or workflow step that forces the agent to check those criteria against reality.
    *   **Measurement:** Evaluator logs show agents self-correcting based on verification failures.
*   **Dependencies:** None.
*   **Scope Limits (NOT doing):**
    *   No "separate QA agent" for every task (too expensive/slow for now).
    *   No formal "unit test" requirement for every bash command (pragmatism first).

---

## Deferred / Non-Actionable

### 3. Formalize "Skills" (Lazy-Loading)
**Status:** **PREMATURE**
**Why:** We have a working `tools.ts`. Refactoring it into a complex "Skill Registry" now would yield low ROI compared to fixing the runtime.
**Action:** Wait until `tools.ts` becomes unmanageable (e.g., >20 tools).

### 4. File-Based Memory
**Status:** **CONSTRAINT (Not a Task)**
**Why:** This is a design principle, not a todo item. We are already doing this.
**Action:** Enforce in Code Reviews. No vector DBs allowed.

---

## Immediate Next Step
**Delegate to Coder:** Implement the P0 Launcher.
