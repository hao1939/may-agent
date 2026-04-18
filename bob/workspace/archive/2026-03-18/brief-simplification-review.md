# Design Brief: Simplification Review Criteria

**Status**: PROPOSAL
**Target**: Tech-Lead Handoffs

## The Problem
"Complexity is the enemy of reliability." (P0). Our system is accumulating parallel implementations of the same concepts (e.g., 5 error handlers in `src/lib/`, 3 retry loops). This violates **P42 Minimalism**.

## The Mandate
Effective immediately, every **Design Review** and **Code Review** must include a specific "Simplification Check". 

## The 4 Criteria
1.  **The "One Way" Rule**:
    -   Is there already a tool/function that does this? If yes, use it or refactor it. Do not add a second one.
    -   *Example*: Don't add `retry_count` to `agent.json` if `manager.ts` handles retries globally.
2.  **The Removal Requirement**:
    -   Does this change allow us to delete code elsewhere?
    -   *Goal*: Net negative line count for refactors.
3.  **The Standard Pattern**:
    -   Does this use standard patterns (Skills, Handoffs, Signatures)?
    -   *Reject*: Custom one-off protocols (e.g., "Agent X writes to `temp.txt`").
4.  **No Speculative Features**:
    -   Does this solve a problem we *actually have* right now (proven by logs)?
    -   *Reject*: "We might need this later." (YAGNI).

## Implementation
-   **Bob**: Will reject any design brief that adds complexity without justification.
-   **Tech-Lead**: Must include a "Simplification Impact" section in every PR description.
-   **Evaluator**: Will flag duplicate mechanisms in `src/lib/`.

## Immediate Action
-   Audit `src/lib/` for duplicate error handling.
-   Audit `agents/` for duplicate skills (e.g., `web-scraping` vs `fetch-url`).
