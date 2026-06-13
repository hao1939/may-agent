# Dispatch Path Delegation Fix

## Summary

Implemented `context_files` and `success_criteria` support in the project task dispatch path. The fix spans two layers:

### 1. Harness-level change (implemented)

**File:** `agents/may/handlers/project.ts` — `buildProjectTaskPrompt()`

Added conditional sections to the dispatched task prompt that include context_files and success_criteria when present on the task object. The prompt now appends:

```
## Context Files
Read these files before acting:
- <file1>
- <file2>

## Success Criteria
- <criterion1>
- <criterion2>
```

### 2. SDK type extension (platform request)

**File:** `projects/platform/repos/may-agent/packages/sdk/src/project-tasks.ts`

The `ProjectTask` interface needs two new fields:

```typescript
context_files: string[];
success_criteria: string[];
```

And `emptyTask()` needs to parse them:

```typescript
context_files: parseList(fields.context_files ?? "[]"),
success_criteria: parseList(fields.success_criteria ?? "[]"),
```

The existing `parseList()` function handles bracket-delimited lists like `[file1.md, file2.md]` which is the natural YAML-like format already used for `depends_on`.

## Usage in project.md

```yaml
- id: my-task
  goal: Do something specific
  assignee: may
  status: ready
  context_files: [contracts/foo.md, outputs/bar.md]
  success_criteria: [File exists at outputs/result.md, Tests pass]
  depends_on: []
```

## Platform Request

**Target:** `@may-agent/sdk` package — `packages/sdk/src/project-tasks.ts`
**Change:** Add `context_files: string[]` and `success_criteria: string[]` to `ProjectTask` interface and parse them in `emptyTask()`
**Test update:** `packages/sdk/src/project-tasks.test.ts` — add the new fields to expected task objects
**Acceptance:** `bun test packages/sdk/src/project-tasks.test.ts` passes with new fields present

The SDK changes have been applied locally (in the gitignored platform repo clone) and tests pass. They need to be committed upstream in the may-agent repo.
