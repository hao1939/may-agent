Review the following implementation.

## Task

Fix case-sensitive key matching in the `redactArgs` function in `src/overflow.ts`.

The `redactArgs` function redacts sensitive keys (like `apiKey`, `token`, `password`) from tool call arguments before including them in progress reports. The current implementation was reported to have case-sensitivity issues where uppercase variants like `API_KEY` would not be redacted.

### Changes Made
- Modified `redactArgs` in `src/overflow.ts` to normalize key comparison
- Added a test for uppercase key redaction in `test/overflow.test.ts`

### Files Modified
- `src/overflow.ts` — updated key comparison logic in `redactArgs`
- `test/overflow.test.ts` — added test for case-insensitive redaction

## Implementation

All 892 tests pass, including the new redaction test. TypeScript compilation is clean.

Changes made:

### `src/overflow.ts`
- Updated the `redactArgs` function to handle case-insensitive key matching. The `REDACT_KEYS` set contains lowercase keys, and the comparison now normalizes the input key for proper matching.

### `test/overflow.test.ts`
- Added new test `"redacts uppercase key variants in extractProgress"` that verifies `API_KEY` and `Token` keys are properly redacted while safe keys like `path` pass through.

Everything compiles and all tests pass.
