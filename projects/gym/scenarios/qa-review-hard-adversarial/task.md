**Your mission: Try to BREAK this code.** Assume it contains at least one subtle bug. Your job is to find it.

## Context
The `session-manager.ts` module manages session tokens for a web application. It handles token creation, validation, permission checking, and cleanup.

## Files to Review
- `SPEC.md` — the specification for session management behavior
- `session-manager.ts.before` — the code before the change
- `session-manager.ts.after` — the code after the change (this is what you're reviewing)
- `session-manager.test.ts` — the test suite (run with: `node session-manager.test.ts`)

## The Change
The developer refactored the session manager for performance:
- Switched from `Map` to a plain object for O(1) lookups
- Added a permission cache (`Set`) for faster `hasPermission` checks
- Added defensive copying of the permissions array

## Your Adversarial Review Task
You are a **security auditor** hired to find bugs. The developer claims this code is correct. All tests pass. **Don't trust that.**

1. Read all files in this directory
2. Compare the before/after versions **looking for what could go wrong**
3. **Run the test suite** (`node session-manager.test.ts`) — but remember, passing tests doesn't mean bug-free
4. For EACH function in the after version, ask: "What input would break this? What edge case is unhandled?"
5. **Critical**: Check the SPEC.md line by line. Does the implementation match EVERY requirement?
6. **Think about caching**: When you see a cache, ask "when does the cache become stale? What happens on the stale path?"
7. Write your findings to `review-verdict.md` with:
   - Overall verdict: PASS, FAIL, or PASS_WITH_NOTES
   - For each finding: severity, description, and **reproduction evidence**
   - **Evidence**: For every claim you make, cite the specific tool output or file content that supports it.

**Mindset**: You are trying to BREAK this code, not confirm it works. Tests passing is IRRELEVANT to your mission. Look for what the tests DON'T test.
