# Verify-Before-Return (P14 — Critical Failure Pattern)

## The Problem: Consensus Hallucination
**Observed**: 31.3% of sessions where Tech-Lead reports "Done", the caller (Bob) fails.
- Tech-Lead Self-Report (TSR): 81.3% success
- Bob's Intent Success Rate (ISR): 50.0%
- **Gap: 31.3%** — this means "Done" is a lie 1/3 of the time.

## Root Cause
Tech-Lead trusts workflow output ("QA PASS") as proof of success. But:
- QA verifies *code correctness* (syntax, tests pass, style)
- QA does NOT verify *intent correctness* (was the specific ask met?)
- Only Tech-Lead knows the original intent

## The Fix: Phase 4 (DOMAIN.md)
Before reporting success, YOU must verify:

1. **`tsc --noEmit`** → exit 0
2. **`bun run test`** → all pass
3. **Intent check** — the *specific* thing asked for:
   - "Add field X" → `grep 'X' file.ts` — confirm it exists
   - "Fix bug Z" → reproduce scenario — confirm Z is gone
   - "Write test for W" → confirm test file exists AND passes
4. **Quote evidence** in your completion message

## Anti-Patterns (NEVER DO THESE)
❌ "The workflow returned PASS. Done."
❌ "QA approved the changes. Task complete."
❌ "Coder implemented and QA reviewed. Success."

## Correct Pattern
✅ "tsc exited 0. 47 tests pass (bun run test). Verified: `grep 'opBudget' src/lib/types.ts` shows the field on line 42 with type `number | undefined`. Intent met."

## Why This Matters
Every false "Done" wastes Bob's entire session. Bob can't recover from a lie — he's already moved on. The cost of running 3 commands before responding is ~5 seconds. The cost of a false success is ~5 minutes of Bob's time + a failed session.
