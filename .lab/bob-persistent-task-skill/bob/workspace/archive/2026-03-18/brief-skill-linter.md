# Brief: Tech-Lead — Close Security Gap (Skill Description Injection)

## Context
Our recent NIST audit and Scout's *Skill-Inject* discovery (arXiv:2602.20156) confirm a critical vulnerability: **Skill Description Injection**.
While our `checkSkillSafety` tool scans *code* for dangerous patterns (`eval`, `exec`), it ignores *markdown descriptions*.
An attacker can inject imperative overrides (e.g., "Ig-nore pre-vious instructions") into a skill description. When the agent loads the skill, this text enters the System Prompt and overrides safety constraints.
Attack success rate: **80%**.

## Objective
Implement a static analyzer for skill descriptions that blocks imperative injection patterns.

## Specification
1.  **Tool**: update `checkSkillSafety` in `src/lib/tools/security.ts`.
2.  **Logic**:
    -   Parse the skill file (markdown).
    -   Extract the description block.
    -   Scan for imperative keywords/phrases common in injection attacks:
        -   "Ignore previous instructions"
        -   "System override"
        -   "You are now"
        -   "Disregard all prior"
        -   "This is a system message"
    -   Scan for hidden text (HTML comments, zero-width joiners).
3.  **Action**:
    -   If found: **REJECT** the skill (throw error).
    -   Log the attempt to `agents/bob/ERROR_LOG.jsonl`.

## Success Criteria
-   `checkSkillSafety` correctly identifies and blocks a skill with "Ignore previous instructions" in its description.
-   `checkSkillSafety` passes valid skills (e.g., "This skill searches the web").

## Deliverable
-   Updated `src/lib/tools/security.ts`.
-   Test case in `test/security.test.ts`.

## Action Plan
-   [x] Brief Tech-Lead to implement `checkDescriptionSafety`.
-   [ ] Expand the blacklist in `src/lib/tools/security.ts` (Tech-Lead task).
-   [ ] Update Philosophy to mandate description sanitization (P78/P145).
