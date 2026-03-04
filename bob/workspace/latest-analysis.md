# Meta-Loop Analysis: Recent Failure Patterns

**Date:** 2026-03-04
**Scope:** 5 most recent evaluations (`s_1772625163096_2` to `s_1772630160332_10`)

## Executive Summary
Analysis of the recent sessions reveals a critical gap in **safe file editing capabilities**. Agents are oscillating between two dangerous extremes: brittle line-number based manipulation (causing corruption) and blunt full-file overwrites (risking data loss).

While other issues exist (system-level prompt duplication), the file editing failures directly impact the integrity of the codebase and drive up costs through repair loops.

## Highest-Impact Issue: Unreliable File Editing Strategies

**Severity:** High (Active Code Corruption)
**Affected Agent:** Coder

### Evidence
1.  **Brittle `sed` Usage (Corruption)**
    *   **Session:** `s_1772629766734_6` (Cost: $0.34, 13 turns)
    *   **Failure:** The agent used `sed` with hardcoded line numbers (`168s`, `174s`). As the file changed, these line numbers drifted, causing the agent to edit the wrong lines.
    *   **Result:** It corrupted the test file, leading to a cascade of failures where it had to debug its own broken edits.
    *   **Quote:** "Used brittle line-number-based `sed` edits... contributed to a self-inflicted test corruption."

2.  **Risky `write` Usage (Data Loss Risk)**
    *   **Session:** `s_1772625163096_2`
    *   **Failure:** The agent used the `write` tool to overwrite entire files after only reading parts of them.
    *   **Result:** While it worked this time, this pattern is statistically dangerous. If the agent's internal context doesn't have the *exact* current file state (e.g., due to truncation or partial reads), a full `write` silently deletes the missing parts.
    *   **Quote:** "Used full-file overwrites... after only partial reads... higher-risk."

### Root Cause
The agents lack a **safe, middle-ground editing tool**.
*   `exec sed`: Powerful but too brittle for LLMs (they are bad at counting lines and predicting drift).
*   `write`: Safe only if context is perfect; dangerous otherwise.

The agents are trying to be efficient by using `sed` to avoid re-writing large files, but they lack the tooling to do it safely (e.g., search-and-replace).

## Secondary Issue: Prompt Duplication
*   **Observation:** Sessions `s_1772630160332_10` and `s_1772629874712_7` both report "duplicated user prompt" or "duplicated user instruction".
*   **Impact:** Confused the QA agent in `_7`, leading to a failed session. Nuisance in `_10`. This suggests a bug in the message dispatch logic (`src/manager.ts` or `src/handoff.ts`).

## Recommendations

1.  **Primary Fix (Optimizer Priority):** Implement a **`replace_in_file`** tool (or equivalent).
    *   **Mechanism:** Exact string match and replace. "Find this block, replace with this block."
    *   **Benefit:** Removes the need for line numbers. If the "Find" block isn't unique or found, it fails safely instead of corrupting the wrong line.
    *   **Alternative:** Enforce a strict lesson: "Never use line numbers with `sed`. Use regex patterns or `perl`."

2.  **Secondary Fix:** Investigate the prompt duplication bug in the `may` agent runner.
