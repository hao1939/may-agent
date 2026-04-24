# Refactoring Plan: `agents/shared/workflows/project.ts` (907 lines)

## Objective
Extract duplicated LoopState pack/unpack blocks and decompose the oversized `execute()` function (lines 670–907, 237 lines) into smaller testable units.

---

## Finding 1: Duplicated LoopState Pack/Unpack Pattern

### Locations (2 identical blocks)
- **Block A** — `project.ts:757-760` (comment iteration)
- **Block B** — `project.ts:863-866` (reviewer iteration)

Both blocks are identical:
```ts
const ls: LoopState = { projectContent, falseDoneCount, lastMilestoneDone, continueWithoutProgress };
const exitResult = await processDecision(ctx, config, ls, journalContent, iteration, decision, ...);
projectContent = ls.projectContent; falseDoneCount = ls.falseDoneCount;
lastMilestoneDone = ls.lastMilestoneDone; continueWithoutProgress = ls.continueWithoutProgress;
if (exitResult) return exitResult;
```

### Root Cause
`LoopState` (`project.ts:470-474`) is used as a mutable struct passed to `processDecision()` (`project.ts:647`), but `execute()` keeps its own local variables. This forces manual pack/unpack at every call site.

### Proposed Extraction

**Option A (preferred): Promote LoopState to a class or persistent object in execute()**

Replace the 4 loose variables (`projectContent`, `falseDoneCount`, `lastMilestoneDone`, `continueWithoutProgress`) at `project.ts:706-709` with a single `LoopState` object that lives for the duration of the loop. Then pass it directly — no pack/unpack needed.

```ts
// In execute(), line ~706:
const ls: LoopState = {
  projectContent,
  falseDoneCount: 0,
  lastMilestoneDone: extractMilestones(projectContent).done,
  continueWithoutProgress: 0,
};
```

All reads of `projectContent` in execute() become `ls.projectContent`, etc. The two 4-line pack/unpack blocks disappear entirely.

- **Lines removable**: ~8 (4 per block × 2)
- **Risk**: Low. Mechanical refactor, all mutations already go through `ls` inside `processDecision`. Just need to update ~20 references from bare variables to `ls.*` within `execute()`.

---

## Finding 2: Duplicated Journal-Write Pattern (legacy vs non-legacy)

### Locations (3 occurrences)
- **Comment iteration journal write** — `project.ts:741-745`
- **Worker iteration journal write** — `project.ts:802-808`
- **Reviewer iteration journal write** — `project.ts:840-844` and `project.ts:848-852`

Each follows the pattern:
```ts
if (config.isLegacy) {
  projectContent += entry;  // or appendToSection
  writeFileSync(config.projectPath, projectContent, "utf-8");
} else {
  appendFileSync(config.journalPath, entry);
}
```

### Proposed Extraction

```ts
function appendJournal(
  config: PersistentTaskConfig,
  entry: string,
  projectContent: string,  // or ls: LoopState if Finding 1 is done first
): string  // returns updated projectContent
```

- **Lines removable**: ~15 (5 lines per occurrence × 3, replaced by 1-line calls)
- **Risk**: Low. Pure I/O helper. The legacy branch uses `appendToSection` in one case (`project.ts:803`) vs direct append in others — need to parameterize or handle that variant.

---

## Finding 3: Oversized `execute()` Function (lines 670–907)

### Structure (237 lines)
| Section | Lines | Description |
|---------|-------|-------------|
| Setup & state checks | 670–718 | Parse config, handle non-active states |
| Main loop: comment iteration | 722–766 | Process pending comments |
| Main loop: worker phase | 769–821 | Run worker agent, journal, update state |
| Main loop: reviewer phase | 824–897 | Run reviewer, evaluator gate, progress tracking |
| Max-iterations exit | 900–907 | Pause on cap |

### Proposed Extractions

**3a. `handleCommentIteration(ctx, config, ls, iteration) → { shouldContinue: boolean, result?: WorkflowResult }`**
- Extract lines 722–766
- ~45 lines moved out
- **Risk**: Low. Self-contained block gated by `if (pendingComments)`.

**3b. `handleWorkerPhase(ctx, config, ls, iteration) → { summary: string, failed: boolean }`**
- Extract lines 769–821
- ~52 lines moved out
- **Risk**: Low. Reads/writes `projectContent` and `consecutiveFailures`. If LoopState is expanded to include `consecutiveFailures`, this is clean.

**3c. `handleReviewerPhase(ctx, config, ls, iteration, workerSummary) → WorkflowResult | null`**
- Extract lines 824–897
- ~73 lines moved out
- **Risk**: Medium. Contains progress tracking, auto-escalation, and the `processDecision` call. Most complex block. Should be tested with mock `ctx`.

### Result after all extractions
`execute()` becomes a ~40-line orchestrator: setup → loop → dispatch to phase handlers → exit.

---

## Summary Table

| Extraction | Lines Removed | Risk | Priority |
|-----------|--------------|------|----------|
| LoopState as persistent object | ~8 | Low | P0 (enables others) |
| `appendJournal()` helper | ~15 | Low | P1 |
| `handleCommentIteration()` | ~45 | Low | P1 |
| `handleWorkerPhase()` | ~52 | Low | P1 |
| `handleReviewerPhase()` | ~73 | Medium | P2 |
| **Total** | **~193** | | |

Post-refactor `execute()` target: ~45 lines. Total file target: ~750 lines.

---

## Follow-up
- Implementation should be done in a separate session.
- Each extraction should be a separate commit for easy rollback.
- Add unit tests for `handleDoneDecision` (`project.ts:512`) and `processDecision` (`project.ts:647`) which currently have zero test coverage.
