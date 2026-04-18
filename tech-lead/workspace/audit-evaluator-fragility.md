# Evaluator Post-Cleanup Fragility Audit

**Date**: 2026-04-13  
**Scope**: `src/lib/evaluator.ts` (454 lines, post-cleanup from ~900)  
**Cleanup commit**: `dc40c1d` — removed `detectFrustrationSignals`, `computeHeuristicScores`, `writeSkippedEvaluations`, `writeHeuristicEvaluations` (809 lines cut)

## Summary

The cleanup was **clean** — no dangling references to removed code found anywhere in `src/`. The remaining evaluator is structurally sound but has **3 medium-severity fragilities** related to error handling around LLM calls and data shape assumptions.

---

## Finding 1: No error handling around `manager.run()` / `manager.waitFor()`

**Severity**: 🟡 MEDIUM  
**Lines**: 540-543 (primary eval), 564-565 (retry), 700-701 (isolated re-eval)

```ts
const evalSessionId = manager.run("evaluator", prompt);         // L540
const evalResult = await manager.waitFor(evalSessionId);        // L541
responseText = evalResult?.lastAssistantText ?? "";             // L542
```

If `manager.run()` throws (e.g., evaluator agent not registered, spawn failure), or if `manager.waitFor()` rejects (timeout, crash), the entire `evaluateTask()` function throws unhandled. The caller in `agent-loader.ts` (L717) would see an uncaught promise rejection.

The **retry path** (L564-565) has the same issue — no try/catch around the retry `run()`/`waitFor()` pair. The **isolated re-evaluation** path (L700-701) IS wrapped in try/catch (L671-733), so that one is safe.

**Impact**: A single evaluator crash kills the entire evaluation pipeline for that heartbeat cycle. Children remain permanently "unevaluated" until the next heartbeat discovers them again (self-healing, but wasteful).

**Recommendation**: Wrap L540-543 in try/catch with a fallback that returns null or uses empty defaults.

---

## Finding 2: `parseTaskEvaluation` silently returns zeros on malformed JSON

**Severity**: 🟢 LOW (by design, but worth noting)  
**Lines**: 240-310

The parser uses a `defaultResult` with all zeros/empty and a single catch block (L297) that swallows JSON parse errors. This means:

1. If the LLM returns valid JSON with **wrong field names** (e.g., `score` instead of `quality`), the agent gets `quality: 0`, `efficiency: 0` — a silent false-negative evaluation.
2. If the LLM wraps the JSON in something other than ` ```json ` (e.g., uses ` ```JSON ` or no fence), the regex at L269 won't match and all agents score 0.

The retry mechanism at L548-571 catches the "no agent scores" case, which covers most failures. But if the JSON parses successfully with wrong field names, the retry won't trigger because `parsed.agents` would have entries (just with zero scores).

**Impact**: Low in practice — the evaluator agent is prompted to use specific field names, and the retry covers the most common failure mode.

---

## Finding 3: `evalResult` could be null without any fallback beyond empty string

**Severity**: 🟡 MEDIUM  
**Lines**: 541-543

```ts
const evalResult = await manager.waitFor(evalSessionId);
responseText = evalResult?.lastAssistantText ?? "";
parsed = parseTaskEvaluation(responseText);
```

If `waitFor` resolves with `null` (session completed but had no messages), or the `TaskResult` has `lastAssistantText: null` (L2353 in manager.ts shows this is the default), then `responseText` is `""` and `parseTaskEvaluation("")` returns all-zeros defaults.

The retry at L548 then fires, but the retry ALSO uses `retryResult?.lastAssistantText ?? ""`. If the evaluator agent is systematically broken (wrong model, misconfigured), both attempts produce empty text, and every child gets scored `quality: 0, efficiency: 0, verdict: "needs_improvement"` — **correct but harsh**.

After both attempts fail, the code proceeds to L585+ and writes these zero-score evaluations to the DB via `upsertEvaluation`. These permanent zero-scores could skew `getAgentScoreSummary` trend calculations. There's no "confidence" flag to distinguish "LLM scored 0" from "LLM was unreachable."

**Impact**: Zero-score evaluations from evaluator failures are indistinguishable from legitimately poor sessions. Could cause false "declining" trends in `computeTrend`.

---

## Finding 4: Duplicate export of `appendErrorLogs`

**Severity**: 🟢 LOW (cosmetic)  
**Lines**: 10, 380

```ts
import { appendErrorLogs } from "./evaluator-error-log.js";    // L10
// ...
export { extractErrorCodes, parseIssueToErrorEntry, appendErrorLogs } from "./evaluator-error-log.js";  // L380
```

`appendErrorLogs` is both imported (for internal use at L761) and re-exported. This works fine in TypeScript but is redundant — the import at L10 could be removed since the re-export at L380 makes it available internally too. Not a bug, just cleanup residue.

---

## Finding 5: No guard against empty `children` in retry prompt construction

**Severity**: 🟢 LOW  
**Lines**: 547-571

The retry is gated by `children.length > 0` (L549), so this is safe. But the retry prompt includes `perAgentTranscripts` which were already constructed — if a transcript was somehow empty or corrupted, the retry prompt would include garbage. This is theoretical; the transcript construction at L473-503 is robust.

---

## Verdict

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | No try/catch around primary eval LLM call | 🟡 MEDIUM | Add try/catch, return null on failure |
| 2 | Silent zero-scoring on wrong JSON field names | 🟢 LOW | Acceptable (retry covers most cases) |
| 3 | Zero-score evals indistinguishable from failures | 🟡 MEDIUM | Add `evaluator_reachable` flag to eval records |
| 4 | Duplicate import/export of appendErrorLogs | 🟢 LOW | Cosmetic cleanup |
| 5 | Theoretical empty transcript in retry | 🟢 LOW | No action needed |

**Overall**: The 49% cleanup was well-executed. No dangling references, no broken exports, no missing imports. The two medium findings (#1 and #3) are pre-existing design choices rather than regressions introduced by the cleanup. The file is in healthy shape.
