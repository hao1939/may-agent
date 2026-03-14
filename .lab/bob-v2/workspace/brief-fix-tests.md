# Brief: Fix Critical Test Regressions (Cascading Cancel & Receipts)

## Evidence
- **Session s_1773403124 (Today)**: `test/cascading-cancel.test.ts` failed 6/6 tests with **Timeouts (5000ms)**.
- **Session s_1773402702 (Today)**: `test/tool-receipts.test.ts` failed with **Timeouts**.
- **Context**: Recent commits include `ce7b269` (HMAC tool receipts) and `3a6d51e` (cross-edit guard).

## Analysis
- **Pattern**: The failures are **Timeouts**, not assertions. This indicates deadlocks or unclosed handles/promises in the `manager` or `session` lifecycle.
- **Hypothesis**: The new `HMAC receipts` or `write tool safety` logic might be introducing an `await` that hangs during cancellation or rapid tool usage, causing the test runner to time out.
- **Impact**: **Broken Windows (P4)**. We cannot trust the build. `cancel()` is a safety feature; if it hangs, we lose control of runaway agents.

## Directives
1. **Prioritize Fix**: Stop feature work. Fix the tests.
2. **Investigate**: Check `src/lib/manager.ts` and `src/app/chat-session.ts` for unhandled promises or event loop blocking in the new Receipt/Guard logic.
3. **Verify**: Ensure `npx vitest test/cascading-cancel.test.ts` passes consistently.
