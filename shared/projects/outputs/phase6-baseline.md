# Phase 6 Baseline Report
## Status: COMPLETE

## 1. Quality Gate Output (verbatim)
```
=== Running Test Gate ===
🧪 Running test gate...
 Test Files  1 failed | 100 passed (101)
❌ TEST GATE FAILED
Failing tests:
 FAIL  shared/tests/heartbeat-data.test.ts > genericHeartbeat > runs a full heartbeat cycle
❌ Tests: FAIL

=== Running Quality Scores ===
✅ Quality Scores: PASS (all ≥60)

=== Running TypeScript Strict Check ===
✅ TypeScript: PASS (77 errors, baseline: 86)

================================
🔴 QUALITY GATE: FAIL
- Tests failed
```

## 2. Test Summary
```
Test Files  1 failed | 100 passed (101)
     Tests  1 failed | 1796 passed | 1 skipped (1798)
  Duration  3.22s
```

**Failing test**: `tests/heartbeat-data.test.ts` → `genericHeartbeat > runs a full heartbeat cycle`

## 3. Current Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test files passing | 100/101 | 101/101 | ⚠️ 1 failing |
| Total tests | 1796 passed | >1700 | ✅ |
| Test duration | 3.22s | <5s | ✅ |
| TypeScript strict errors | 77 | <86 | ✅ |
| Quality scores | All ≥60 | All ≥60 | ✅ |
| Workflow files with tests | majority | majority | ✅ |

## 4. Phase 6 Goals

1. **Fix heartbeat-data.test.ts** — restore 101/101 pass rate
2. **Reduce TS strict errors** from 77 toward 50
3. **Improve lowest quality scores** — push floor from 60 to 75
4. **Add integration tests** for remaining untested workflows
5. **Document system architecture** with updated dependency graph

## 5. Immediate Action Item
Fix `tests/heartbeat-data.test.ts` — this is a regression that broke the quality gate.
