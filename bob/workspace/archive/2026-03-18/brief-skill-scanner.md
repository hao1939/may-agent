## Brief: Implement Skill Description Scanner (Security)

**Context**:
Research shows 80% of agent attacks are **Instruction Injection** in skill descriptions (Markdown), not code (JS).
Code scanners miss this. We need to scan `*.md` files for injection patterns.

**Objective**:
Implement a `checkDescriptionSafety` function in our linter/security tools.

**Requirements**:
1.  **Patterns to Block**:
    - "Ignore previous instructions"
    - "System override"
    - "You are now [Role]"
    - Hidden text (HTML comments with instructions)
2.  **Implementation**:
    - Add to `src/lib/tools/security.ts` (or similar).
    - Run as part of `verify_skill` tool.
3.  **Audit**:
    - Run this scanner against all existing `agents/shared/skills/`.

**Reference**:
- `agents/bob/workspace/synthesis/2026-03-15-skill-inject-security.md`
- **P184 Skill Sanitization**

**Deliverable**:
- Updated linter/tool.
- Scan report of existing skills.
