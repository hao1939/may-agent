# Test Fixes Report

All 4 failing test files fixed. 120/120 tests now pass across these files.

## Changes Made

### 1. `agents/shared/tests/fewshot-inject-helpers.test.ts`
- **Line 18**: Changed test task from "please add a button to the UI" to "hello world greetings" — the old text now matches the `add.*page` pattern in `EXAMPLE_PATTERNS`
- **Line 232**: Changed test task from "add a new button to the page" to "hello world greetings" — same pattern match issue

### 2. `agents/shared/tests/heartbeat-data.test.ts`
- **Lines 412-416**: Removed second `runAgent` mock setup and changed expected call count from 2 to 1. The EXP-740 duration gate was removed from source, so `runAgent` is only called once now.

### 3. `agents/shared/tests/master-worker-execute.test.ts`
- **Lines 312-313**: Changed expected log from "RETRY" to "BLOCKED". The zero-output retry block was removed from master-worker.ts; zero output now proceeds to review which returns BLOCKED.

### 4. `agents/shared/tests/master-worker-retry-integration.test.ts`
- **Lines 104-119**: Replaced two tests that checked master-worker.ts imports/uses `withWorkerRetry` with tests that verify: (a) the retry block was removed, and (b) the worker-retry module still exports its functions for other consumers.

## Verification
```
Test Files  4 passed (4)
Tests       120 passed (120)
```
