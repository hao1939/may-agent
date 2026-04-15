# Patch: Improve bash:other classification in tool-quality-scan.ts

**Target file**: `agents/may/handlers/tool-quality-scan.ts`
**Function**: `classifyFailure()` (line ~102)
**Author**: optimizer
**Date**: 2026-03-25T12:42

## Change
In `classifyFailure()`, add 3 lines before `return "other"` to sub-classify:

### Current code (around line 125):
```typescript
  if (tool === "edit" && (rootCause.includes("Could not find") || rootCause.includes("exact text"))) return "edit-match-fail";
  if (rootCause.includes("P53") || rootCause.includes("convention")) return "convention-block";

  return "other";
```

### Proposed code:
```typescript
  if (tool === "edit" && (rootCause.includes("Could not find") || rootCause.includes("exact text"))) return "edit-match-fail";
  if (rootCause.includes("P53") || rootCause.includes("convention")) return "convention-block";

  // Sub-classify common bash failures (was all lumped into "other")
  if (rootCause.includes("command not found") || result.includes("command not found")) return "cmd-not-found";
  if (/cd:.*No such/.test(rootCause) || /cd:.*No such/.test(result)) return "cd-bad-path";
  if (/cannot (stat|access|open)/.test(rootCause) || /cannot (stat|access|open)/.test(result)) return "file-not-found-bash";

  return "other";
```

## Why
- `bash:other` = 148 calls = 69% of all waste
- 56% is "command not found" (npx, bun, sqlite3)
- 26% is file-not-found through bash (ls, mv on nonexistent)
- 19% is cd to wrong paths
- Better classification enables targeted fixes per sub-category

## Testing
No new tests needed — `classifyFailure` is a pure function and existing test coverage through the handler's normal operation will validate. The change only refines classification buckets.

## Risk
Zero — only affects reporting categories in the tool quality report. No runtime behavior change.
