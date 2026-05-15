# Iteration 10: Synchronous Status Flip Verification

**Date:** 2026-05-15  
**Commit:** `d49160b0b` — fix(project-comments): make webui comments land in discussion.md

## What Changed

In `agents/may/handlers/project.ts`, the `reactivate` and `add-comment` actions were refactored to perform the status flip synchronously and independently from the comment write:

### Before (combined)
```ts
// reactivate
let content = ph.appendComment(ph.updateField(project.content, "Status", "active"), action.reason);
writeFileSync(project.projectFile, content, "utf-8");

// add-comment
let content = ph.updateField(ph.appendComment(project.content, action.comment), "Status", "active");
writeFileSync(project.projectFile, content, "utf-8");
```

### After (synchronous flip + separate comment)
```ts
// reactivate
const content = ph.updateField(project.content, "Status", "active");
writeFileSync(project.projectFile, content, "utf-8");
ph.appendDiscussionComment(dirname(project.projectFile), action.reason, "project-handler");

// add-comment
const content = ph.updateField(project.content, "Status", "active");
writeFileSync(project.projectFile, content, "utf-8");
ph.appendDiscussionComment(dirname(project.projectFile), action.comment, "project-handler");
```

## Why This Matters

1. **Status flip is immediate** — the workflow scheduler sees `active` as soon as the handler runs, regardless of whether discussion.md write succeeds.
2. **Comments go to the canonical location** — `discussion.md` instead of the legacy `## Comments` section in `project.md`.
3. **No interleaved state** — previously `appendComment` modified project.md content that included both the status and the comment; now each file gets exactly one write.

## Verification

- **Test suite:** 893 tests pass, 0 failures (3.37s)
- **Relevant test files verified in commit message:** 70/70 project-health tests, 5/5 command-router tests
- **Supporting changes:** `shared/lib/project-health.ts` provides `appendDiscussionComment()` and `unreadDiscussionTail()` which `shared/workflows/project.ts` now delegates to.

## Conclusion

The synchronous status flip is correct and verified. The separation of concerns (status in project.md, comments in discussion.md) eliminates the race where the workflow might not see the comment because it was embedded in project.md's now-removed `## Comments` section.
