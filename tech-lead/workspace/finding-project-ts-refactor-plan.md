# Refactor Plan: agents/shared/workflows/project.ts

**File**: `agents/shared/workflows/project.ts` (900 lines)
**Objective**: Reduce `execute()` complexity, eliminate duplicated done/blocked handling, identify dead code.

---

## Top 3 Refactoring Extractions

### 1. Extract `handleDecisionOutcome()` — eliminate 2x duplicated done/blocked dispatch

**Lines**: 728–745 (comment iteration) and 844–862 (review iteration)
**Problem**: The LoopState creation, `handleDoneDecision` call, field destructuring back from `ls`, outcome matching, and `handleBlockedDecision` call are copy-pasted identically in two places (`project.ts:728-745` and `project.ts:844-862`).

**Proposed function**: `async function handleDecisionOutcome(ctx, config, ls, journalContent, iteration, decision, isComment): Promise<{action: 'return', value: WorkflowResult} | {action: 'continue'} | {action: 'next'}>`

This would encapsulate the LoopState ↔ local variable sync pattern (lines `project.ts:731-735` and `project.ts:847-851`) and the blocked branch (`project.ts:741-743` and `project.ts:858-860`).

**Estimated reduction**: ~25 lines

### 2. Extract `runReviewerPhase()` — encapsulate reviewer + journal append + milestone check-off

**Lines**: 813–887 (`project.ts:813-887`)
**Problem**: The reviewer phase is a 75-line block inside the main loop that handles: running the reviewer agent, error fallback, extracting decisions, appending journal entries (with legacy/non-legacy branching at `project.ts:830-834` and `project.ts:839-843`), milestone check-off (`project.ts:845-850`), progress tracking (`project.ts:863-873`), and auto-escalation (`project.ts:876-883`). This is the densest section of `execute()`.

**Proposed function**: `async function runReviewerPhase(ctx, config, ls, journalContent, iteration, workerSummary): Promise<{action: 'return', value: WorkflowResult} | {action: 'continue'}>`

**Estimated reduction**: ~60 lines from `execute()`

### 3. Extract `runCommentIteration()` — encapsulate comment processing

**Lines**: 707–753 (`project.ts:707-753`)
**Problem**: The comment iteration block is ~47 lines handling: building the review prompt, running the agent, formatting journal entries (with legacy branching at `project.ts:722-726`), clearing comments, and dispatching to done/blocked handlers. It's a self-contained phase that could be a function.

**Proposed function**: `async function runCommentIteration(ctx, config, ls, journalContent, iteration): Promise<{action: 'return', value: WorkflowResult} | {action: 'next'}>`

**Estimated reduction**: ~40 lines from `execute()`

---

## Bug: Undefined `score` Variable

**Location**: `project.ts:880`
**Severity**: Runtime error (will crash when hit)
**Evidence**: Line 880 references `score` in `emitProjectEvent(ctx, config, "project.blocked", { iteration, health: score, ... })`, but `score` is not defined in the `execute()` function scope. The `score` variable is only defined inside `handleDoneDecision` (`project.ts:531`) and `handleBlockedDecision` (`project.ts:626`). This code path is reached when `continueWithoutProgress >= 5` after a CONTINUE decision — no evaluator has run, so no score exists.

**Fix**: Either remove `health: score` or run an evaluator before this escalation point.

---

## Dead/Suspicious Code

### 1. Unused `prevContent` variable
**Location**: `project.ts:864`
**Evidence**: `const prevContent = projectContent;` is assigned but never read. The re-read on the next line overwrites `projectContent` directly.

### 2. `oldStatus` variable unused
**Location**: `project.ts:749`
**Evidence**: `const oldStatus = state.status;` is assigned but never referenced afterward.

---

## Summary

| Extraction | Lines | Reduction | Priority |
|---|---|---|---|
| `handleDecisionOutcome()` | 728–745, 844–862 | ~25 lines | High (dedup) |
| `runReviewerPhase()` | 813–887 | ~60 lines | High (complexity) |
| `runCommentIteration()` | 707–753 | ~40 lines | Medium |
| **Bug fix**: undefined `score` | 880 | 1 line | **Critical** |
| Dead code: `prevContent`, `oldStatus` | 864, 749 | 2 lines | Low |

Total estimated reduction: ~125 lines from `execute()` (currently ~257 lines → ~132 lines).
