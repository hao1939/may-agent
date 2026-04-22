# Finding: Safest First Refactor for `execute()` in project.ts

## Summary

The `execute()` function (`project.ts:681-918`, 237 lines) contains a clearly extractable **comment iteration block** (`project.ts:740-780`) that can be pulled into a standalone async function with zero behavioral change. This is the safest first extraction because it has a clean entry condition, uses only values already available at the call site, and ends with `continue` — making the control flow trivially preservable.

## Evidence

### The Extractable Block: Comment Iteration Handler

**Location**: `project.ts:740-780` (approximately 40 lines)

The block is guarded by `if (pendingComments)` at `project.ts:740` and ends with `iteration++; continue;` at `project.ts:779-780`. It:

1. Builds a comment review prompt via `buildReviewPrompt()` (`project.ts:747`)
2. Runs the owner agent (`project.ts:751`)
3. Extracts the decision (`project.ts:752`)
4. Writes a journal entry (`project.ts:756-764`)
5. Clears comments and updates fields (`project.ts:767-768`)
6. Delegates to `processDecision()` (`project.ts:771`)
7. Sets status to active and continues (`project.ts:777-780`)

**Inputs** (all available at call site): `ctx`, `config`, `projectContent`, `journalContent`, `iteration`, `continueWithoutProgress`, `falseDoneCount`, `lastMilestoneDone`

**Outputs**: Updated `projectContent`, `falseDoneCount`, `lastMilestoneDone`, `continueWithoutProgress`, and optionally a `WorkflowResult` (early return).

### Why This Is the Safest

1. **Already uses `LoopState` pattern**: The block already packs state into a `LoopState` object at `project.ts:768` and unpacks it at `project.ts:770-771`. A new function would simply receive and return `LoopState` — the marshaling pattern is already established.

2. **Clean control flow boundary**: The block ends with `continue` (`project.ts:780`), so the extracted function returns either a `WorkflowResult` (to exit) or `null` (caller does `iteration++; continue`). This matches the existing `processDecision()` return convention (`project.ts:658`).

3. **No shared mutable state beyond LoopState**: The block doesn't touch `consecutiveFailures` (only the worker phase does, `project.ts:804`). It only mutates the same `LoopState` fields that `processDecision` already mutates.

4. **Analogous extraction already exists**: `handleBlockedDecision()` (`project.ts:613-656`) and `processDecision()` (`project.ts:658-678`) were already extracted from similar inline logic. This is the same pattern.

## Proposed Signature

```typescript
async function handleCommentIteration(
  ctx: WorkflowContext,
  config: PersistentTaskConfig,
  ls: LoopState,
  journalContent: string,
  iteration: number,
): Promise<WorkflowResult | null>
```

Returns `WorkflowResult` if the loop should exit, `null` if it should `continue`.

## Severity

- **Risk**: Low — pure mechanical extraction
- **Impact**: Reduces `execute()` by ~40 lines (17%), improves readability, and makes the comment iteration path independently testable

## Recommended Action

Extract `project.ts:740-780` into `handleCommentIteration()`. Place it adjacent to `handleBlockedDecision()` (~line 613). The call site becomes:

```typescript
if (pendingComments) {
  const result = await handleCommentIteration(ctx, config, ls, journalContent, iteration);
  // unpack ls fields...
  if (result) return result;
  iteration++;
  continue;
}
```

## Follow-up (separate session)

After the comment iteration extraction, the **reviewer phase** block (`project.ts:825-905`, ~80 lines) is the next candidate — it follows a similar pattern but is larger and has the progress-tracking tail that needs careful handling.
