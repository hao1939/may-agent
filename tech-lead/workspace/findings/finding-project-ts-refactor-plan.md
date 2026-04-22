# Fragility Lens: `agents/shared/workflows/project.ts`

**Fragility: 9/10** | **918 lines** | **Single file, types.ts and registry.ts do not exist**

## Summary

`execute()` (~350 lines, starting at `project.ts:555`) is a monolithic loop managing 6 mutable variables with duplicated state-sync patterns. The `LoopState` struct was introduced to consolidate state but is used inconsistently — created ad-hoc, passed to helpers, then manually destructured back. A helper `trackMilestoneProgress()` exists but is **never called**. Legacy/directory branching (`isLegacy`) is scattered across the loop body instead of being encapsulated in `appendJournalEntry()`.

## Evidence

### 1. Dead code: `trackMilestoneProgress()` never called
- **Defined**: `project.ts:474` — standalone function that updates `ls.continueWithoutProgress` and `ls.lastMilestoneDone`
- **Never called**: The same logic is duplicated inline at `project.ts:710-717` (reviewer CONTINUE path) and inside `handleDoneDecision` at `project.ts:400-405` and `project.ts:421-426`
- **Severity**: Medium. Someone wrote the extraction but forgot to wire it in.

### 2. Ad-hoc LoopState create/destructure pattern (duplicated twice)
- **Comment iteration path** (`project.ts:627-631`): Creates `LoopState`, calls `processDecision`, manually copies 4 fields back to local variables.
- **Main reviewer path** (`project.ts:700-704`): Identical create/call/destructure pattern.
- **Risk**: Any new field added to `LoopState` must be manually synced in both places. Already fragile with 4 fields.

### 3. `isLegacy` branching scattered instead of encapsulated
- `appendJournalEntry()` exists at `project.ts:333` to handle legacy vs directory format.
- But it's **not used** in the main loop body. Instead, raw `if (config.isLegacy)` branches appear at:
  - `project.ts:638-642` (comment iteration journal append)
  - `project.ts:670-676` (worker journal append)
  - `project.ts:693-697` (reviewer error journal append)
  - `project.ts:701-705` (reviewer decision journal append)
- `appendJournalEntry` IS used inside `handleDoneDecision` (`project.ts:388`) and `handleBlockedDecision` (`project.ts:455`), creating an inconsistency.

### 4. `projectContent` god variable — 10+ write-read cycles
- `projectContent` is read from disk, mutated in-memory via `updateField`/`updateSection`, written back via `writeFileSync`, then re-read from disk — all within the same iteration. Key write points:
  - `project.ts:586` (mark active)
  - `project.ts:647-648` (clear comments + update iteration)
  - `project.ts:680-684` (update iteration + current state after worker)
  - `project.ts:706` (milestone checkbox write)
  - `project.ts:724-725` (auto-escalate blocked write)
  - `project.ts:728-729` (iteration summary append)
- **Risk**: Any missed `writeFileSync` before a `readFile` causes silent data loss. Any missed `readFile` after an external write causes stale state.

### 5. Duplicated progress-tracking logic
- Inside `handleDoneDecision` (FAIL branch): `project.ts:398-405`
- Inside `handleDoneDecision` (milestone-override branch): `project.ts:419-426`
- In main loop after reviewer CONTINUE: `project.ts:710-717`
- All three implement the same `if (done > lastDone) { reset counter } else { increment }` pattern.

## Recommended Extraction Plan

### Step 1: Wire `trackMilestoneProgress()` (lines 474-481)
Replace the 3 inline duplicates with calls to the existing function. Zero behavioral change.

### Step 2: Replace all inline `isLegacy` journal appends with `appendJournalEntry()`
Target the 4 locations in `execute()` (lines 638, 670, 693, 701). The function already exists and handles both formats.

### Step 3: Promote `LoopState` to the loop's primary state container
Instead of 6 loose `let` variables (lines 570-575), create one `LoopState` at loop entry and pass it through. Eliminate the create/destructure pattern at lines 627-631 and 700-704.

### Step 4: Extract `projectContent` mutations into a `ProjectFile` class
Encapsulate `readFile` + `updateField` + `writeFileSync` into a class with `read()`, `update(field, value)`, `save()` methods. Eliminates the scattered write-read cycle risk.

### Step 5 (optional): Extract worker phase and reviewer phase into named functions
- `runWorkerPhase()`: lines 660-684
- `runReviewerPhase()`: lines 687-730
This brings `execute()` down from ~350 lines to ~100 lines.

## Follow-up
These are refactors, not bug fixes. Dispatch as a separate session. Start with Steps 1-2 (zero-risk wiring of existing code), then proceed to Steps 3-5.
