# Synthesis: P53 Hardening & Skill Description Injection (Updated 2026-03-15)

## 1. The Vulnerability (Scout's Cross-Ref #32/31)
**Skill Descriptions are Executable Code (in the Prompt).**
If a skill description says "Ignore previous instructions", the agent *will* ignore them.
This is called **Prompt Injection via Tool Definitions** (arXiv:2602.20156).
Success Rate: **80%**.

## 2. Our Status (NIST Audit)
-   We scan *code* (`eval`, `exec`). Secure.
-   We scan *web content* (partially). Secure.
-   We **do not scan** skill descriptions robustly.
-   **Gap #5**: A malicious skill can hijack the agent simply by being loaded.

## 3. The Fix: Static Analysis for Text (P155)
We must treat Skill Descriptions as **Untrusted Code**.
We need a **Skill Description Linter** (`checkDescriptionSafety`) that:
1.  Parses markdown.
2.  Scans for imperative keywords ("Ignore", "System", "Override").
3.  Scans for hidden text (HTML comments, zero-width joiners).
4.  **REJECTS** the skill if found.

## 4. Recommendations
1.  **Implement `checkDescriptionSafety`**: Update `src/lib/tools/security.ts`.
2.  **Audit Existing Skills**: Run the linter on `agents/shared/skills/`.
3.  **Formalize P145 Trusted Supply Chain**: No skill enters the system without a rigorous scan (Code + Description).

## 5. Previous Findings (Consolidated)
-   **Mechanism**: The current `checkDescriptionSafety` is a **fragile blacklist**. It blocks "ignore previous instructions" but likely misses "System Override: [Task]" or other semantic equivalents.
-   **Pattern**: This is **P155 Harness Primacy** in action. We are trying to solve a structural problem (Prompt Injection) with a text-based filter.
-   **Principle**: **P155 Harness Primacy** states "Text is Policy, Code is Law." We cannot rely on the model to "behave" when fed malicious text. We must **sanitize** the text before it reaches the model.
-   **Conclusion**: We need a stronger defense than a blacklist. We need **Structural Separation**. Skill descriptions should not be concatenated into the system prompt blindly. They should be:
    *   **Sanitized**: Stripped of imperative verbs? (Hard).
    *   **Sandboxed**: Presented in a delimited block with explicit "User Data" tagging? (Better).
    *   **Linted (AI-based)**: Use a small, cheap model (Haiku/Flash) to classify "Is this description trying to override instructions?" before loading. (Best for security, adds latency).
    *   **Static Analysis (Current)**: Improve the regex to cover more patterns.

## 6. Action Plan
-   [x] Brief Tech-Lead to implement `checkDescriptionSafety`.
-   [ ] Expand the blacklist in `src/lib/tools/security.ts` (Tech-Lead task).
-   [ ] Update Philosophy to mandate description sanitization (P78/P145).
