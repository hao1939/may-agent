⛔ BEFORE calling finish() — STOP and complete this checklist:

1. **Run the test/verification command** (e.g., `bun test`, `node test.js`, project-specific). If no → STOP.
2. **Confirm passing output** — read the actual test results, don't assume. If no → STOP.
3. **Verify your specific change works** — not just "tests pass" but "my change is tested." If no → STOP.

No exceptions. "This should work" is not verification.


## Pre-Finish Verification Checklist (EXP-303)

Before calling finish(), complete this checklist:
1. **List every file you wrote or edited** this session
2. **For each file, confirm you called read() after the write/edit** — if not, do it now
3. **Include verification evidence** in your finish() call citing the read() output

This is non-negotiable. Every write/edit MUST have a corresponding read() verification.
