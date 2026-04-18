# Architecture Audit: src/lib/evaluator.ts (831 lines)

**Date**: 2026-04-14  
**Auditor**: Scout (Lens A — System Architecture)

---

## 1. Major Subsystems

The file contains **6 distinct subsystems**:

| # | Subsystem | Lines | Scope |
|---|-----------|-------|-------|
| 1 | **Types & interfaces** | 22–68 | `UsageSummary`, `AgentScores`, `TaskEvaluationResult` |
| 2 | **Usage extraction** | 69–96 | `extractUsage()` — token/cost aggregation from messages |
| 3 | **Transcript formatting** | 104–237 | `formatTranscript()` (standard), `formatIsolatedTranscript()` (EXP-039) |
| 4 | **Response parsing** | 240–312 | `parseTaskEvaluation()` — JSON+markdown extraction from LLM output |
| 5 | **Task-tree evaluation** (core) | 337–768 | `findUnevaluatedChildren()`, `buildEvalPrompt()`, `evaluateTask()` |
| 6 | **Score aggregation** | 770–831 | `getAgentScoreSummary()`, `computeTrend()` |

Plus **re-exports** from satellite files:
- `evaluator-failure-chain.ts` (476 lines) — `extractFailureChains`, `formatFailureChains`
- `evaluator-error-log.ts` (139 lines) — `extractErrorCodes`, `parseIssueToErrorEntry`, `appendErrorLogs`

**Total evaluator system**: 831 + 476 + 139 = **1,446 lines** across 3 files.

---

## 2. Architecture Assessment

### 2.1 Clean Split: Satellite Extraction ✅

Failure chains and error logging have been properly extracted to separate files. The re-export pattern keeps the public API surface at `evaluator.ts`.

### 2.2 Transcript Formatting — 3 Independent Implementations ⚠️

There are **three** transcript formatters in the codebase:

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `formatTranscript()` | evaluator.ts:104 | ~55 | Standard eval transcript |
| `formatIsolatedTranscript()` | evaluator.ts:161 | ~75 | EXP-039: strips agent self-narrative |
| `formatTranscriptCompact()` | session-digest.ts:406 | ~? | Lighter version for digests |
| `formatTranscriptForLearning()` | context-learn.ts:361 | ~? | Learning-specific format |

These share ~60% logic (iterate messages, handle toolResult/assistant/user roles, truncate tool results). No shared base. If one gets a bug fix (e.g., new message type handling), the others don't.

**Recommendation**: Extract a shared `formatMessages()` core with options (`{ includeThinking, includeAgentText, truncateAt, includeUserMessages }`) into a `transcript-format.ts`. Each consumer provides a config.

### 2.3 evaluateTask() — The 320-Line Monolith 🔴

`evaluateTask()` (lines 447–768) is the core function and does **too many things**:

1. Registry lookup → find unevaluated children (lines 455–460)
2. Per-child transcript + usage aggregation (lines 463–520)
3. Per-session transcript truncation (lines 487–495)
4. Total transcript budget enforcement (lines 521–540) — **P110b**
5. Prompt construction via `buildEvalPrompt()` (lines 543)
6. LLM evaluation + retry on malformed output (lines 546–570)
7. Per-agent score matching with duplicate-name handling (lines 579–640) — complex
8. EXP-039 isolated re-evaluation (lines 648–730) — **entire second eval pass**
9. DB persistence via `upsertEvaluation()` (lines 733–753)
10. Error log appending (line 756)

The score-matching logic (step 7) is particularly fragile — it handles duplicate agent names via `usedParsedKeys` tracking, fallback key matching, and order-based disambiguation. This is the kind of code that breaks silently.

**The EXP-039 re-evaluation block (step 8, lines 648–730)** duplicates the transcript-building loop from step 2. If transcript truncation logic changes, it must be updated in two places.

**Recommendation**: Split into:
- `buildEvalPayload()` — steps 1–4 (data preparation)
- `runEvaluation()` — steps 5–6 (LLM interaction + retry)
- `matchScoresToSessions()` — step 7 (score reconciliation)
- `persistEvaluationResults()` — steps 9–10

### 2.4 Heuristic vs LLM Evaluation Split

The split is **mostly clean** at the DB level:
- `hasLLMEvaluation()` checks `evaluatedByHeuristic = 0 AND skippedByJs = 0`
- `findUnevaluatedChildren()` only skips LLM-evaluated sessions, allowing heuristic→LLM upgrades

However, the heuristic evaluator itself is **not in this file** — it's in the evaluation table/requests layer. The gating logic (`hasLLMEvaluation` in `findUnevaluatedChildren`) is the only coupling point. This is clean.

---

## 3. Dead/Unused Code

### 3.1 `hasEvaluation` — Dead Import 🔴
```
Line 11: import { upsertEvaluation, hasEvaluation, hasLLMEvaluation, getAllEvaluations } from "./requests.js";
```
`hasEvaluation` is imported but **never used** in the file. Only `hasLLMEvaluation` is called (line 354). Dead import since the heuristic/LLM split was introduced.

### 3.2 `extractErrorCodes`, `parseIssueToErrorEntry` — Dead Re-exports ⚠️
```
Line 380: export { extractErrorCodes, parseIssueToErrorEntry, appendErrorLogs } from "./evaluator-error-log.js";
```
- `extractErrorCodes` and `parseIssueToErrorEntry` are re-exported from evaluator.ts
- Neither is re-exported from `index.ts`
- Neither is imported by any file outside evaluator-error-log.ts itself
- `appendErrorLogs` IS used (line 756), but the other two are internal to error-log and don't need re-export

### 3.3 `formatIsolatedTranscript` — Unnecessary Export ⚠️
```
Line 161: export function formatIsolatedTranscript(...)
```
Exported from evaluator.ts but:
- NOT re-exported from index.ts
- Only called within evaluator.ts itself (lines 485, 675)
- Could be a plain `function` (not exported)

### 3.4 Lessons Path — Documented Dead Code ✅
```
Line 763: // Note: result.lessons is still parsed and returned...
// but we no longer write to knowledge/lessons.md (dead path — nobody loads it).
```
This is correctly documented. The `parseTaskEvaluation()` still parses `### Lessons` from LLM output and `TaskEvaluationResult` still carries `.lessons`, but nothing consumes it downstream. The field itself is lightweight (string|null), so low urgency.

---

## 4. Entry Point Architecture (P0 Bug Context)

The `evaluateTask()` entry point is called from **two places**:
1. `src/app/agent-loader.ts:717` — via handler context injection
2. `src/app/may.ts:446` — direct import

The gating logic flow:
```
evaluateTask() called
  → gets registry
  → findUnevaluatedChildren() filters by:
      - parentSessionId match
      - not in skipAgents (default: {"evaluator"})
      - not running/idle
      - !hasLLMEvaluation() ← the upgrade gate
      - has messages
  → returns null if no children
```

**Fragility assessment**: The gating is straightforward but has an implicit dependency — `findUnevaluatedChildren` takes `persistDir` and `registry` as separate args and assumes they reference the same data store. If these get out of sync (e.g., registry is cached, DB is fresh), evaluations could be skipped or duplicated. Currently safe because both are read synchronously, but worth noting.

The retry logic (lines 553–570) is simple — one retry if JSON parse fails. No exponential backoff or circuit breaker, but for a single eval pass this is fine.

---

## 5. Summary of Findings

| Finding | Severity | Action |
|---------|----------|--------|
| `evaluateTask()` is 320-line monolith with 10 responsibilities | 🔴 High | Split into 4 focused functions |
| 3+ transcript formatters share no code | ⚠️ Medium | Extract shared `formatMessages()` core |
| `hasEvaluation` dead import | 🔴 Low effort | Remove import |
| `extractErrorCodes`/`parseIssueToErrorEntry` dead re-exports | ⚠️ Low | Remove re-exports from line 380 |
| `formatIsolatedTranscript` unnecessarily exported | ⚠️ Low | Remove `export` keyword |
| EXP-039 re-eval duplicates transcript-building loop | ⚠️ Medium | Extract to shared helper |
| `.lessons` field parsed but never consumed | ℹ️ Info | Document or remove in future cleanup |
| Score-matching logic (usedParsedKeys) is fragile | ⚠️ Medium | Extract + add test coverage |

**Overall**: The file is functional and the satellite extraction (failure-chain, error-log) was a good move. The main issue is `evaluateTask()` trying to do everything — transcript building, LLM orchestration, score matching, persistence, AND the EXP-039 re-evaluation pass. Splitting this function is the highest-value refactor.
