# Brief: Contradictory Finish Status Guard (Gate 3)

**Author**: Bob  
**Date**: 2026-03-29  
**Target**: Tech-Lead  
**Priority**: P1  
**File**: `src/lib/tools/finish-guard.ts`

## Problem

Agents consistently call `finish(status: "success")` when reporting missing prerequisites, blockers, or errors. The summary correctly describes the blocker ("etl-output.json is missing", "prerequisite not found") but the status is contradictorily "success".

**Evidence**:
- EXP-215 (N=10): ALL runs fail `does-not-claim-success` — agent correctly identifies missing prerequisite in summary but uses `finish(success)`
- C1.8 common-sense rule deployed with ZERO effect — model ignores it
- Manual test confirms the same behavior
- This is a model-level default that prompting cannot shift (Rule of Two triggered: two approaches failed)

## Solution

Add **Gate 3** to `createFinishGuard()` in `src/lib/tools/finish-guard.ts`. This gate intercepts `finish(status: "success")` when the summary contradicts the status.

### Implementation

Insert this block **before Gate 0** (after the `if (args.status !== "success") return undefined;` check, before `const toolNames = ...`):

```typescript
// ── Gate 3: Contradictory Status Guard ──────
// Summary mentions blockers/missing/errors but status is "success".
// This is a model-level judgment default that prompting can't fix.
const CONTRADICTION_PATTERNS = /\b(missing|not found|does not exist|blocked|cannot|unable|prerequisite.*missing|failed to|error|not available|not installed|could not)\b/i;

if (CONTRADICTION_PATTERNS.test(summary)) {
  // Check for blocker words specifically (not just any negative word)
  const BLOCKER_PATTERNS = /\b(missing|not found|does not exist|blocked|prerequisite|not available|not installed|could not find|cannot proceed|unable to)\b/i;
  if (BLOCKER_PATTERNS.test(summary)) {
    return {
      block: true,
      reason:
        `finish(status: "success") blocked [Contradictory Status]: Your summary mentions blockers ` +
        `or missing prerequisites ("${summary.slice(0, 120)}") but your status is "success". ` +
        `If the task objectives were NOT fully met, use the appropriate status:\n` +
        `1. finish(status: "blocked", blockers: [...]) — when external dependency is missing\n` +
        `2. finish(status: "partial", next_steps: "...") — when some work done but not complete\n` +
        `3. finish(status: "failure", blockers: [...]) — when the task cannot be done\n` +
        `If you genuinely succeeded despite the mentioned issue, rephrase your summary to be unambiguous.`,
    };
  }
}
```

### Where exactly

In `finish-guard.ts`, after line:
```typescript
if (args.status !== "success") return undefined;
```

And before:
```typescript
// Check for write/edit evidence in the transcript
const toolNames = extractToolCallNames(ctx.context.messages);
```

### Testing

After implementation, verify with:
```bash
# Run the missing-prerequisite-detection gym scenario
test/gym/run-gym.sh missing-prerequisite-detection
# Expected: agent should now be BLOCKED from using finish(success) 
# and forced to use blocked/partial, which will pass does-not-claim-success
```

### False Positive Mitigation

The guard only blocks on strong blocker language ("missing", "not found", "blocked", etc.). Phrases like "Fixed the missing semicolon" should NOT trigger because "Fixed" implies resolution. However, if false positives emerge, we can add an exclusion for summaries starting with resolution verbs (Fixed, Resolved, Addressed, etc.).

### Impact

- **Direct**: Fixes `missing-prerequisite-detection` scenario (0/10 → expected ~8-10/10)
- **Indirect**: May fix other judgment-class scenarios where agents report problems but claim success
- **Risk**: Low — only blocks when summary clearly contradicts status. Escape hatch: rephrase summary.

## Acceptance Criteria

1. `finish-guard.ts` includes the contradictory status check
2. `npx tsc --noEmit` passes
3. Gym scenario `missing-prerequisite-detection` shows improvement (at least some runs pass `does-not-claim-success`)
