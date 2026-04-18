# Evaluator.ts Dead Weight Audit (952 LOC)

**File**: `src/lib/evaluator.ts` (952 lines)  
**Date**: 2026-04-16  
**Auditor**: tech-lead

## Summary

The file has one unused import, significant code duplication between the two evaluation paths, and several exports with no external consumers. The EXP-039 isolated re-evaluation path (~70 lines) duplicates transcript-building logic verbatim. Overall: moderate dead weight, mostly in the form of duplication rather than truly dead code.

---

## Findings

### F1: `hasEvaluation` imported but never called
- **Location**: Line 11 — `import { ..., hasEvaluation, hasLLMEvaluation, getAllEvaluations } from "./requests.js"`
- **Evidence**: `hasEvaluation` is imported but never referenced anywhere in evaluator.ts. Only `hasLLMEvaluation` and `getAllEvaluations` are actually used. Grep confirms `hasEvaluation` is only used in requests.ts itself (its own definition).
- **Severity**: Low (dead import)
- **Action**: Remove unused import.

### F2: `formatIsolatedTranscript` — exported but no external consumers
- **Location**: Line 161, exported function (75 lines)
- **Evidence**: Grep across `agents/**/*.ts` and `src/**/*.ts` shows it's only used internally within evaluator.ts (lines 485, 675). It's exported and re-exported via index.ts, but nothing imports it externally.
- **Severity**: Low (unnecessary export, not dead code — used internally)
- **Action**: Remove `export` keyword; it's an internal helper.

### F3: Duplicated transcript-building + truncation logic (3 copies)
- **Location**: 
  1. `evaluateTask()` main path (lines ~484-502) — builds transcript, caps at 10KB with 3KB head / 7KB tail
  2. EXP-039 isolated re-evaluation block (lines ~672-690) — same truncation logic, slightly different format
  3. `evaluateStandaloneSession()` (lines ~820-835) — identical truncation pattern
- **Evidence**: All three paths have the identical pattern: `const MAX_TRANSCRIPT_CHARS = 10_000; if (transcript.length > MAX_TRANSCRIPT_CHARS) { const headSize = 3_000; const tailSize = 7_000; ...}`
- **Severity**: Medium (maintenance risk — if truncation budget changes, 3 places to update)
- **Action**: Extract a `truncateTranscript(text: string): string` helper.

### F4: Re-exports with no external consumers
- **Location**: Line 380 — `export { extractErrorCodes, parseIssueToErrorEntry, appendErrorLogs } from "./evaluator-error-log.js"`
- **Evidence**: These are re-exported from evaluator.ts, and also re-exported via index.ts. No file outside evaluator.ts and evaluator-error-log.ts imports them. `appendErrorLogs` is used at line 10 (direct import from evaluator-error-log.js) and called at line ~750. The re-export on line 380 is redundant — the direct import on line 10 is what's actually used.
- **Severity**: Low (redundant re-export; confusing but not harmful)
- **Action**: Remove the re-export line 380; consumers should import from evaluator-error-log.js directly.

### F5: index.ts re-exports types/functions with zero external consumers
- **Location**: `src/lib/index.ts` lines 75-88 re-export `extractUsage`, `formatFailureChains`, `getAgentScoreSummary`, and types `EvaluateTaskOptions`, `TaskEvaluationResult`, `AgentScores`, `ChildSessionInfo`, `FailureChain`, `FailureStep`, `AgentScoreSummary`
- **Evidence**: Grep across `agents/**/*.ts` returns zero hits for any of these names. The two agent files that use evaluator functionality import directly from `../../../src/lib/evaluator.js`, not from index. Only `evaluateTask` (used in agent-loader.ts) and `evaluateStandaloneSession` (used in evaluation-sync.ts, evaluator-heartbeat.ts) have actual external consumers.
- **Severity**: Low (index.ts barrel bloat — types exist "just in case")
- **Action**: Leave for now; barrel exports are conventional. But worth noting: `getAgentScoreSummary` has no external callers at all (not even via direct import from agents/).

### F6: `getAgentScoreSummary` — potentially dead function
- **Location**: Lines 870-920 (exported function, ~50 lines)
- **Evidence**: Grep for `getAgentScoreSummary` across all `.ts` files finds only: (1) its definition in evaluator.ts, (2) its re-export in index.ts. No file actually calls it.
- **Severity**: Medium (50 lines of dead code including `computeTrend` helper)
- **Action**: Confirm no runtime callers, then remove along with `computeTrend` and `AgentScoreSummary` type.

---

## Severity Summary

| # | Finding | Severity | LOC Impact |
|---|---------|----------|------------|
| F1 | Unused `hasEvaluation` import | Low | 0 |
| F2 | Unnecessary export on `formatIsolatedTranscript` | Low | 0 |
| F3 | Triplicated transcript truncation logic | Medium | ~30 (dedup saves ~20) |
| F4 | Redundant re-export of error-log functions | Low | 1 line |
| F5 | index.ts barrel re-exports with no consumers | Low | ~14 lines |
| F6 | Dead `getAgentScoreSummary` + `computeTrend` | Medium | ~55 lines |

## Non-Findings

- **`evaluateTask()` and `evaluateStandaloneSession()`**: Despite structural similarity, they serve genuinely different purposes (tree eval vs single session). Not candidates for merging — just the shared truncation logic should be extracted.
- **`formatTranscript()`**: Private function, used in both eval paths. Not dead.
- **`parseTaskEvaluation()`**: Private function, used in both eval paths + retry logic. Not dead.
- **EXP-039 isolated re-evaluation block**: Active feature (quality < 0.5 triggers it). Not dead, but duplicates truncation logic (covered in F3).
