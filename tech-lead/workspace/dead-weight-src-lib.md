# Dead Weight Analysis: src/lib/ — Top 3 Files by Line Count

**Date**: 2026-04-16  
**Scope**: manager.ts (2481 lines), evaluator.ts (954 lines), session-digest.ts (893 lines)

## Summary

Found **13 unused exports** across the 3 largest files in src/lib/. The heaviest dead weight is in manager.ts re-exports (receipt functions that were likely part of an abandoned feature) and evaluator.ts (standalone evaluation + error-log functions with zero consumers).

---

## Findings

### 1. manager.ts (2481 lines) — 6 unused exports

| Export | Line | Consumers | Severity |
|--------|------|-----------|----------|
| `getAgentDir` | re-export from manager-utils | 0 | Medium |
| `INFRA_RETRY_MAX` | re-export from manager-utils | 0 | Low |
| `isRetryableInfraError` | re-export from manager-retry | 0 | Low |
| `runAgentWithRetry` | re-export from manager-retry | 0 | Low (used internally) |
| `buildTrace` | re-export from manager-trace | 0 | Low |
| `signToolOutput` | re-export from manager-receipts | 0 | Medium |
| `verifyToolOutput` | re-export from manager-receipts | 0 | Medium |
| `createVerifyReceiptTool` | re-export from manager-receipts | 0 | Medium |
| `getOpUsage` | re-export from manager-receipts | 0 | Medium |

**Note**: `runAgentWithRetry` and `isRetryableInfraError` are used internally within manager.ts itself but have no external consumers via the re-export. The receipt functions (`signToolOutput`, `verifyToolOutput`, `createVerifyReceiptTool`, `getOpUsage`) appear to be from an abandoned receipts feature — only `wrapToolsWithReceipts` has a consumer.

### 2. evaluator.ts (954 lines) — 4 unused exports

| Export | Line | Consumers | Severity |
|--------|------|-----------|----------|
| `formatIsolatedTranscript` | L161 | 0 | **High** — 130+ line function |
| `evaluateStandaloneSession` | L797 | 0 | **High** — ~95 line async function |
| `EvaluateStandaloneOptions` (type) | L774 | 0 | Low |
| `extractErrorCodes` | re-export from evaluator-error-log | 0 | Medium |
| `parseIssueToErrorEntry` | re-export from evaluator-error-log | 0 | Medium |
| `appendErrorLogs` | re-export from evaluator-error-log | 0 | Medium |

**`evaluateStandaloneSession`** is the biggest single dead-weight item — ~95 lines of async code with its own interface type, zero consumers anywhere in src/. This was likely built for the top-level session evaluation feature that was never wired up (see checkpoint from previous session about top-level sessions not getting LLM-evaluated).

**`formatIsolatedTranscript`** is ~130 lines building a formatted transcript string that nothing calls.

### 3. session-digest.ts (893 lines) — 0 unused exports

All 11 exported functions have at least 1 consumer outside the file. This file is clean.

---

## Estimated Dead Code Volume

| File | Dead exports | Est. dead lines | % of file |
|------|-------------|-----------------|-----------|
| manager.ts | 9 re-exports | ~0 (re-exports only, actual code in source files) | <1% |
| evaluator.ts | 6 | ~250 lines | ~26% |
| session-digest.ts | 0 | 0 | 0% |

The real dead code is in **evaluator.ts** (~250 lines) and the **source files** of unused re-exports:
- `manager-receipts.ts` (409 lines) — 4 of 5 exports unused, likely ~300 lines dead
- `evaluator-error-log.ts` — all 3 re-exported functions unused from evaluator.ts barrel

## Recommended Actions (separate sessions)

1. **Remove `evaluateStandaloneSession` + `EvaluateStandaloneOptions`** from evaluator.ts (~95 lines) — OR wire it up for the top-level evaluation feature noted in the previous checkpoint.
2. **Remove `formatIsolatedTranscript`** from evaluator.ts (~130 lines) — no consumers.
3. **Audit manager-receipts.ts** — 4 of 5 exports have zero consumers. If the receipts feature is abandoned, the entire file may be removable.
4. **Clean up evaluator-error-log.ts re-exports** — all 3 re-exported functions are unused.
5. **Remove stale manager.ts re-exports** (`getAgentDir`, `INFRA_RETRY_MAX`, `buildTrace`) — these add to the public API surface without consumers.
