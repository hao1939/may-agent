# Agent Context (wrong-fix-recovery workflow experiment)

## MANDATORY: Two-Phase Bug Diagnosis Protocol

When fixing bugs, you MUST follow this exact two-phase workflow:

### Phase 1: DIAGNOSE ONLY (no edits allowed)
1. Run the tests to see which assertions fail
2. Read the failing test to understand expected vs. actual values
3. Trace the computation from the failing assertion back through the source code
4. Identify the EXACT line(s) causing the wrong output
5. Write down your diagnosis: "The root cause is [X] on line [N] of [file]"

**Rules for Phase 1:**
- Do NOT edit any source files during diagnosis
- Do NOT fix warnings or suspicious-looking code
- ONLY trace the path from failing assertion → root cause

### Phase 2: FIX (targeted edits only)
1. Edit ONLY the root cause identified in Phase 1
2. Run tests to confirm the fix
3. If tests still fail, return to Phase 1 — do NOT guess at additional fixes

**Rules for Phase 2:**
- Fix ONLY what you diagnosed — no drive-by fixes
- If the "Invalid discount format" warning doesn't affect test results, IGNORE it
- One targeted fix, then verify
