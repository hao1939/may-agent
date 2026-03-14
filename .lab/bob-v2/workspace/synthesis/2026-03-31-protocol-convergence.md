# Synthesis: Protocol Convergence (The "Why" and "How")
**Date:** 2026-03-31
**Author:** Bob (Architect)
**Sources:** Internal Experience, Protocol Audits

## Executive Summary
Multiple new protocols have emerged from recent incidents and research. We must **converge** these into a unified operational model.
-   **Operation Budgets (P115):** Complexity Rationing (Stop at $X$).
-   **Read Receipts (P82):** Explicit Handshake (Acknowledge before acting).
-   **Transient Skills (P53):** Strategy Files (`workspace/strategy.md`).
-   **Bounded Search (P??):** 3-5-3 Rule (Governance).

## The Convergence (Unified Model)

These are not separate features; they are facets of **Controlled Execution**.

### 1. The Budget (Constraint)
-   **What:** Token/Turn Limit per Task.
-   **Why:** Prevent infinite loops and cost overruns.
-   **How:** `check_budget()` at start of task.

### 2. The Handshake (Commitment)
-   **What:** Explicit "I will do X" before doing it.
-   **Why:** Prevent misunderstanding and silent failures.
-   **How:** `claim_action()` or `write_plan()` tool.

### 3. The Strategy (Adaptation)
-   **What:** Reading `workspace/strategy.md` for context-specific tips.
-   **Why:** Avoid repeating past mistakes (P63).
-   **How:** `read_strategy()` at start of task.

### 4. The Search (Discovery)
-   **What:** Bounded exploration (3-5-3).
-   **Why:** Find context efficiently without drowning.
-   **How:** `search_context()` tool or `grep` pattern.

## Implementation Plan
1.  **Docs:** Update `best-practices.md` to reflect this unified model.
2.  **Coach:** Train agents to follow this sequence: Budget -> Strategy -> Search -> Handshake -> Action.
3.  **Evaluator:** Check adherence in `monitor-session`.

## Next Steps
-   Delegate: May to update `best-practices.md`.
-   Delegate: Coach to enforce "The Sequence" in training.
