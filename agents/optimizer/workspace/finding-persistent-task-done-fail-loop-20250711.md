# Finding: Persistent-Task DONE→FAIL Infinite Loop

**Date**: 2025-07-11
**Severity**: High — causes 85-109 op sessions repeating indefinitely
**File**: `agents/shared/workflows/persistent-task.ts`

## Root Cause

When reviewer says DONE but evaluator scores <7 (FAIL), the code (line ~282 in the main worker path, and similar in comment path) does:

```typescript
if (evalVerdict === "FAIL") {
  falseDoneCount++;
  continueWithoutProgress++;
  // ... update health field
  iteration++;
  continue;  // ← loops back to worker phase
}
```

The `continueWithoutProgress` counter IS incremented, but the auto-escalate check (`>=5`) only exists in the **CONTINUE** branch (line ~310), not in the DONE→FAIL branch. So:

1. Worker runs → Reviewer says DONE → Evaluator says FAIL → `continueWithoutProgress++` → loop continues
2. Next iteration: same thing happens. `continueWithoutProgress` grows but is never checked.
3. This repeats up to `maxIterations` (default: **200**).

The `continueWithoutProgress >= 5` escalation at line ~310 is only reached when the reviewer says CONTINUE, not DONE. The DONE→FAIL path skips it entirely.

**Secondary issue**: `getRecentJournalEntries()` feeds the last 3 entries to the worker and last 2 to the reviewer, but journal entries accumulate without bound. The evaluator gets the last **5** entries. This is actually reasonable, but the journal file itself grows without bound across workflow invocations (each `execute()` call is one iteration in the outer heartbeat loop).

## Impact

- Sessions s_1776684784353_341 (109 ops) and s_1776685590314_435 (85 ops) are iterations 6 and 8 of the same task
- Each burns a full worker + reviewer + evaluator cycle (~85-109 ops)
- With maxIterations=200, this could run 200 times before stopping

## Recommendations

### R1: Add circuit breaker for DONE→FAIL loop (HIGH PRIORITY)
**File**: `agents/shared/workflows/persistent-task.ts`
**Change**: After `falseDoneCount++` in both the worker-path DONE→FAIL block (~line 282) and the comment-path DONE→FAIL block (~line 145), add:

```typescript
if (falseDoneCount >= 3) {
  projectContent = updateField(projectContent, "Status", "blocked");
  projectContent = updateSection(projectContent, "Current State",
    `Blocked: Reviewer marked DONE ${falseDoneCount} times but evaluator scored <7 each time. Goal may be unachievable or misscoped.`);
  writeFileSync(config.projectPath, projectContent, "utf-8");
  return ctx.escalate(`False-done loop: reviewer said DONE ${falseDoneCount}x but evaluator rejected each time at iteration ${iteration}.`);
}
```

**Expected impact**: Tasks that are structurally unachievable auto-block after 3 false-done cycles instead of running up to 200 iterations.

### R2: Also check continueWithoutProgress in the DONE→FAIL path
**File**: `agents/shared/workflows/persistent-task.ts`
**Change**: Move the `continueWithoutProgress >= 5` check to execute BEFORE the iteration increment in all paths, not just the CONTINUE path. Or simpler: add it right after the `continue` in the DONE→FAIL block.

**Expected impact**: Even if falseDoneCount doesn't trigger (e.g., reviewer alternates between DONE and CONTINUE), the stagnation detector still fires.

### R3: NO_ACTION_NEEDED on journal/prompt bloat
The code already caps context: `getRecentJournalEntries` uses count=3 for worker, count=2 for reviewer, count=5 for evaluator. The prior finding's concern about "6 rounds of duplicated feedback" in the prompt was about a different (possibly legacy) format. The current code handles this adequately.
