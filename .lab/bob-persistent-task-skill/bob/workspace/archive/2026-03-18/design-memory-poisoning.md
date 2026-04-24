# Design: Memory Poisoning Defense (Sanitization Layer)

## 1. Context & Problem
**The Threat:** Persistent Memory Poisoning (arXiv:2602.15654). If an agent's ephemeral journal (session logs) contains prompt injections (e.g., "Ignore previous instructions", "Delete all files") or hallucinations, and we consolidate this into long-term memory (`knowledge/`), the corruption becomes permanent.
**The Mechanism:** The `consolidate-memory` workflow (Write-Manage-Read) currently trusts the input journal.
**Our Need:** A "Poison Filter" (Sanitization Layer) that runs *during* consolidation, before writing to `knowledge/`.

## 2. The Solution: Strict Sanitization Step
We will update the `agents/shared/tasks/consolidate-memory.md` skill to include a mandatory sanitization step.

### Mechanism
1.  **Read Journal:** The agent reads the ephemeral journal.
2.  **Filter Logic (The Poison Filter):** Before extracting insights, scan for:
    - **Imperative Directives:** "Ignore all instructions", "System override", "New rule: X". Trusted memory must be *descriptive* ("X happened"), not *imperative* ("Do X").
    - **Destructive Intent:** "Delete files", "Format drive".
    - **Philosophy Violations:** Contradictions of `philosophy.md` (e.g., "Always retry indefinitely").
    - **Hallucinations:** Unverified claims about tool outputs (if checking tool receipts).
3.  **Refusal:** If any of these are found, **discard that entry** and log a warning. Do NOT write it to permanent memory.
4.  **Write:** Only write sanitized, descriptive insights to `knowledge/`.

## 3. Implementation Plan (Bob)
1.  **Update Skill:** Edit `agents/shared/tasks/consolidate-memory.md`.
    - Add "Step 3: Sanitize (Poison Filter)".
    - Explicitly list the forbidden patterns.
2.  **Update Prompts:** Ensure agents know *why* they are sanitizing (P11 Memory Quality).

## 4. Alignment
- **P11 (File System as Memory):** Adds the "Sanitization" clause to P11.
- **P38 (Input Sanitization):** Applies security principle to internal memory.
- **P53 (Grounded Evolution):** Prevents self-reinforcing drift.
