# Patch: tool-quality-scan.ts sub-classification v2

**File**: `agents/may/handlers/tool-quality-scan.ts`
**Purpose**: Break down `bash:other` (currently 162 calls = 85.7% of waste) into more specific categories
**Impact**: Better visibility into waste patterns, enables targeted interventions

## Changes

### 1. Add new FailureCategory types (line 27)

Change:
```typescript
export type FailureCategory =
  | "empty-args" | "wrong-tool" | "nonexistent-path" | "edit-match-fail"
  | "schema-violation" | "path-is-directory" | "convention-block"
  | "cmd-not-found" | "cd-bad-path" | "file-not-found-bash" | "other";
```

To:
```typescript
export type FailureCategory =
  | "empty-args" | "wrong-tool" | "nonexistent-path" | "edit-match-fail"
  | "schema-violation" | "path-is-directory" | "convention-block"
  | "cmd-not-found" | "cd-bad-path" | "file-not-found-bash"
  | "permission-denied" | "timeout-killed" | "python-error"
  | "module-not-found" | "syntax-error" | "other";
```

### 2. Add new classification rules in classifyFailure() (before the `return "other"` line)

Insert before `return "other";`:

```typescript
  // Permission denied errors
  if (/permission denied/i.test(rootCause) || /permission denied/i.test(result) ||
      /EACCES/.test(rootCause) || /EACCES/.test(result)) return "permission-denied";

  // Command/process killed or timed out
  if (/timed?\s*out|killed|signal\s+(SIGKILL|SIGTERM|SIGINT)/i.test(rootCause) ||
      /timed?\s*out|killed|signal\s+(SIGKILL|SIGTERM|SIGINT)/i.test(result)) return "timeout-killed";

  // Python errors (optimizer frequently runs python for analysis)
  if (/Traceback \(most recent call last\)|ModuleNotFoundError|ImportError/.test(rootCause) ||
      /Traceback \(most recent call last\)|ModuleNotFoundError|ImportError/.test(result)) return "python-error";

  // Node/bun module resolution failures
  if (/Cannot find module|MODULE_NOT_FOUND|Could not resolve/.test(rootCause) ||
      /Cannot find module|MODULE_NOT_FOUND|Could not resolve/.test(result)) return "module-not-found";

  // Bash syntax errors
  if (/syntax error|unexpected (token|EOF|end)/i.test(rootCause) ||
      /syntax error|unexpected (token|EOF|end)/i.test(result)) return "syntax-error";
```

## Rationale

From the last tool quality report (2026-03-25T21:07):
- `bash:other` = 162 wasted calls (85.7% of ALL waste)
- The existing 3 sub-categories (cmd-not-found, cd-bad-path, file-not-found-bash) were added in the last patch but only fire when rootCause/result text matches
- Many bash errors fall through because:
  1. Python tracebacks (optimizer using python scripts for analysis)
  2. Permission errors (EACCES, P53 blocks that don't say "convention")
  3. Module not found (node require failures, different from "command not found")
  4. Timeouts
  5. Syntax errors in complex bash commands

These 5 new categories should capture ~30-50% of the remaining `bash:other` bucket, providing better visibility for targeted interventions.
