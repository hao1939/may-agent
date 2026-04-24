# Critical Security Brief: Restore Skill Linter (P78)

## Context
- **Gap**: `src/lib/tools/security.ts` is MISSING.
- **Cause**: Deleted by May in session `s_1773470593760_550` (1773472291) as part of "Remove P53 Bash Guard".
- **Impact**: We lost `checkDescriptionSafety` (The Skill Linter). We are currently vulnerable to Skill Injection (P78).
- **Misconception**: The team believes this exists because we confused "Bash Guard" (Hao said remove) with "Skill Linter" (Hao said keep/refine).

## Requirement
Restore **only** the Skill Linter logic. Do **not** restore the Bash Guard.

## Spec
1. Create `src/lib/tools/skill-linter.ts` (new name to avoid confusion).
2. Implement `checkDescriptionSafety(description: string): boolean`.
3. Logic:
   - Block "Ignore previous instructions" patterns.
   - Block hidden text (HTML comments, zero-width joiners).
   - Block "System override" patterns.
   - **Do not** block bash commands (curl, wget) — that was the P53 error.
4. Add unit test `test/tools/skill-linter.test.ts`.

## Deliverable
- `src/lib/tools/skill-linter.ts`
- Passing tests.
