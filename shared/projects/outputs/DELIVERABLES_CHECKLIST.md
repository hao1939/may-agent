# DELIVERABLES_CHECKLIST.md

## Task: Fix 14 failing tests in verify-after-write guard and heartbeat tests

| # | Deliverable | Status | File | Change |
|---|------------|--------|------|--------|
| 1 | Fix guards.test.ts verify-after-write tests | DONE | agents/shared/tests/guards.test.ts | Changed `write` → `edit` in tool call mocks |
| 2 | Fix verify-after-write-deep.test.ts | DONE | agents/shared/tests/verify-after-write-deep.test.ts | Changed `write` → `edit` in tool call mocks |
| 3 | Fix verify-after-write-extended.test.ts | DONE | agents/shared/tests/verify-after-write-extended.test.ts | Changed `write` → `edit` in tool call mocks |
| 4 | Fix verify-after-write-guard.test.ts | DONE | agents/shared/tests/verify-after-write-guard.test.ts | Changed `write` → `edit` in tool call mocks |
| 5 | Fix heartbeat-data.test.ts | DONE | agents/shared/tests/heartbeat-data.test.ts | Added `deliverables` to mock return |
| 6 | Fix agents/test/verify-after-write.test.ts | DONE | agents/test/verify-after-write.test.ts | Fixed incorrect assertion |
| 7 | All tests passing | DONE | — | 172/172 tests pass across 7 files |
