# Complexity Refactor Report
## Status: COMPLETE

## Top 3 Files by Cyclomatic Complexity (before)
| File | Complexity Score |
|------|-----------------|
| project.ts | 217 |
| master-worker.ts | 147 |
| heartbeat-data.ts | 110 |

## Refactoring: project.ts

### Problem
The comment directive handling section (lines 830-950) contained 5 nearly-identical code blocks for `[continue]`, `[pause]`, `[cancel]`, `[resume]`, and `[done]` directives. Each block repeated the same pattern:
1. Create timestamped journal entry
2. Append to journal (legacy vs directory format)
3. Clear comments
4. Update iteration field
5. Update status field
6. Optionally clear stop/resume fields
7. Optionally update Current State
8. Write to disk
9. Mark discussion read
10. Emit event

### Solution
Extracted `handleDirectiveComment()` helper function that accepts a `DirectiveConfig` object with:
- `label` — journal entry label (CONTINUE, PAUSED, etc.)
- `status` — new status value
- `event` — event to emit
- `trigger` — event trigger value
- `currentState` — optional Current State update
- `clearStopFields` — whether to clear Stop Reason + Resume Condition

### Results
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| File lines | 1184 | 1146 | -38 (-3.2%) |
| Complexity score | 217 | 214 | -3 |
| Duplicated blocks | 5 × ~20 lines each | 1 helper + 5 × 2-line calls | -90 lines of duplication |
| Test files passing | 10/10 project tests | 10/10 project tests | ✅ No regressions |

### Before (one of 5 identical blocks)
```typescript
if (isContinueComment) {
  const now = new Date().toISOString();
  const commentEntry = `### Iteration ${iteration} (comment) — ${now}\n` + ...
  if (config.isLegacy) { projectContent += commentEntry; }
  else { cachedAppend(config.journalPath, commentEntry); }
  projectContent = clearComments(projectContent);
  projectContent = updateField(projectContent, "Iteration", String(iteration));
  projectContent = updateField(projectContent, "Status", "active");
  projectContent = updateField(projectContent, "Stop Reason", "");
  projectContent = updateField(projectContent, "Resume Condition", "");
  cachedWrite(config.projectPath, projectContent);
  markDiscussionRead(config.projectDir, iteration);
  emitProjectEvent(ctx, config, "project.resumed", { iteration, trigger: "continue-comment" });
  iteration++;
  continue;
}
```

### After
```typescript
if (isContinueComment) {
  projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
    { label: "CONTINUE", status: "active", event: "project.resumed", trigger: "continue-comment", clearStopFields: true }, ctx);
  iteration++;
  continue;
}
```

### Test Verification
```
npx vitest run tests/project — 10 files, 239 tests, all passing
```

Note: The pre-existing `heartbeat-data.test.ts` failure is unrelated to this refactoring.

