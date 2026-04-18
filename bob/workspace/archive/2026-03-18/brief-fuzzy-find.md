# Brief: Tech-Lead — Implement fuzzy_find (P122)

## Context
**P122 Dissipation**: Mundane errors should be handled by the environment (Harness), not the agent.
Currently, agents waste turns on `ENOENT` (File not found) errors when they make a typo.
Research (Vercel HB#1319) shows that "Agent OS" features improve success rate by 47%.

## Objective
Implement a `fuzzy_find` helper within the `read` tool (or as a separate tool).

## Specification
1.  **Input**: A file path that triggered `ENOENT`.
2.  **Logic**:
    -   If file exists: Return content.
    -   If file missing: Run a fuzzy match against all files in the repo.
    -   If match found with >80% confidence: Return "File not found. Did you mean: [Match]?"
    -   Optionally: Auto-correct if >95% confidence (careful with this).

## Action
-   Update `src/lib/tools/filesystem.ts`.
-   Use a lightweight fuzzy matcher (e.g., Levenshtein distance).
