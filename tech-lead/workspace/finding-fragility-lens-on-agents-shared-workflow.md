# Fragility Analysis: agents/shared/workflows/project.ts

**File**: `agents/shared/workflows/project.ts` (898 lines, fragility 9/10)

## Executive Summary

The `execute()` function (lines 643–898, **255 lines**) is a monolithic loop with high cyclomatic complexity driven by three axes of branching: comment-vs-worker iterations, legacy-vs-directory format, and done/blocked/continue decision handling. The file has **36 reassignments to `projectContent`** and **22 `writeFileSync` calls**, creating a fragile mutable-state web where missed writes or stale reads cause silent data loss.

---

## Finding 1: execute() Size and Cyclomatic Complexity

**Severity**: High

The `execute()` function at `project.ts:643-898` spans 255 lines with an estimated cyclomatic complexity of **18+**, driven by:
- 6 early-return guards (`project.ts:660-669`)
- Comment iteration branch (`project.ts:700-745`)
- Worker phase (`project.ts:748-799`)
- Reviewer phase nested inside iteration check (`project.ts:803-880`)
- Legacy branching (`config.isLegacy`) at 8 locations within execute: `project.ts:694,718,783,816,829`

**Recommendation**: Extract three functions: `handleCommentIteration()`, `runWorkerPhase()`, `runReviewerPhase()`.

## Finding 2: Duplicated Legacy Branching (8 sites)

**Severity**: High

The `config.isLegacy` branch appears at 8 call sites across the file, each implementing the same pattern: "if legacy, append to projectContent + writeFileSync; else appendFileSync to journal". Key duplications:

1. `project.ts:718-722` — comment iteration journal append
2. `project.ts:783-790` — worker iteration journal append  
3. `project.ts:816-821` — reviewer error journal append
4. `project.ts:829-834` — reviewer decision journal append

The `appendJournalEntry()` helper at `project.ts:487-504` was extracted to handle this but is **only used inside `handleDoneDecision` and `handleBlockedDecision`**. The main loop at lines 718, 783, 816, 829 still does the branching inline.

**Recommendation**: Use `appendJournalEntry()` consistently at all 4 inline sites.

## Finding 3: Mutable State via LoopState Struct-Passing

**Severity**: High

The `LoopState` interface (`project.ts:470-475`) wraps 4 mutable fields. In `execute()`, the caller constructs a `LoopState`, passes it to `handleDoneDecision`, then **manually destructures mutations back** at two call sites:

- `project.ts:733-735`: `projectContent = ls.projectContent; falseDoneCount = ls.falseDoneCount; lastMilestoneDone = ls.lastMilestoneDone; continueWithoutProgress = ls.continueWithoutProgress;`
- `project.ts:849-851`: Same 4-field copy-back

This is error-prone: any new field added to `LoopState` must be manually synced at both sites. The pattern exists because `handleDoneDecision` mutates `ls` in place (`project.ts:510`) but the caller holds separate local variables.

**Recommendation**: Promote `LoopState` to the single source of truth. Replace the 6 local `let` variables in `execute()` (lines 672-676) with a single `LoopState` object used throughout, eliminating the copy-back pattern.

## Finding 4: projectContent Reassignment Chain

**Severity**: Medium

`projectContent` is reassigned **36 times** across the file. Within `execute()` alone, the pattern is: read → mutate in memory → write to disk → re-read from disk → mutate again. Example chain at `project.ts:793-800`:

```
projectContent = readFile(config.projectPath) ?? projectContent;  // :795
projectContent = updateField(projectContent, "Iteration", ...);   // :798
projectContent = updateSection(projectContent, "Current State"..);// :799
writeFileSync(config.projectPath, projectContent, "utf-8");       // :801
```

Any interruption between mutation and write loses state. Any read-after-write may get stale data if another process writes.

**Recommendation (Phase 2)**: Introduce a `ProjectFile` class that wraps content + dirty flag + auto-flush, reducing the mutation surface.

---

## Phased Refactor Plan

### Phase 1: Extract Helpers (Low Risk)
1. **Use `appendJournalEntry()` at all 4 inline sites** (`project.ts:718,783,816,829`). Eliminates legacy branching duplication.
2. **Extract `handleCommentIteration()`** from `project.ts:700-745` (~45 lines).
3. **Extract `runReviewerPhase()`** from `project.ts:803-880` (~77 lines).

### Phase 2: Reduce State Mutation
1. **Promote `LoopState`** to be the single mutable container. Replace 6 local `let` variables with `ls.iteration`, `ls.consecutiveFailures`, etc. Eliminates copy-back at lines 733-735 and 849-851.
2. **Introduce `ProjectFile` wrapper** with `update()`, `save()`, `reload()` methods to encapsulate the read-mutate-write chain.

### Phase 3: Simplify Control Flow
1. **Extract iteration dispatch**: The main `while` loop body is ~180 lines. After Phase 1 extractions, it should be ~40 lines of dispatch logic.
2. **Unify legacy/directory format** behind a `Storage` interface with `appendJournal()` and `readJournal()` methods, eliminating all `isLegacy` branches.

### Biggest Win: Before/After Pseudocode

**Before** (execute main loop, ~180 lines):
```typescript
while (iteration <= config.maxIterations) {
  projectContent = readFile(config.projectPath) ?? projectContent;
  // ... 15 lines of comment handling setup ...
  if (pendingComments) {
    // ... 45 lines of comment iteration ...
    // inline legacy branching for journal
    if (config.isLegacy) { projectContent += entry; } 
    else { appendFileSync(...); }
    // manual LoopState copy-back
    projectContent = ls.projectContent; falseDoneCount = ls.falseDoneCount; ...
  }
  // ... 50 lines of worker phase with inline legacy branching ...
  if (iteration % config.reviewEvery === 0) {
    // ... 77 lines of reviewer phase with inline legacy branching ...
    // another manual LoopState copy-back
    projectContent = ls.projectContent; falseDoneCount = ls.falseDoneCount; ...
  }
  iteration++;
}
```

**After** (~30 lines):
```typescript
const ls = new LoopState(config, initialState);
const storage = config.isLegacy ? new LegacyStorage(config) : new DirStorage(config);

while (ls.iteration <= config.maxIterations) {
  ls.reloadProject();
  if (ls.isPausedOrCancelled()) return ls.exitStatus(ctx);

  const comments = ls.pendingComments();
  if (comments) {
    const result = await handleCommentIteration(ctx, config, ls, storage, comments);
    if (result) return result;
    continue;
  }

  const workerSummary = await runWorkerPhase(ctx, config, ls, storage);
  if (!workerSummary) continue; // worker error, already handled

  if (ls.iteration % config.reviewEvery === 0) {
    const result = await runReviewerPhase(ctx, config, ls, storage, workerSummary);
    if (result) return result;
  }
  ls.iteration++;
}
return ls.maxIterationsReached(ctx);
```

---

## Follow-ups
- **Fix**: Apply Phase 1 extractions (low risk, no behavior change)
- **Fix**: Unify all 4 inline legacy branches to use `appendJournalEntry()`
- **Fix**: Promote LoopState to single mutable container
