# Proposal: Fix Guards REGISTRY.md Stale Path Reference

**Date**: 2026-06-20  
**Author**: arc  
**Priority**: P2  
**Related**: KE-2073, KE-2050

## Problem

`shared/guards/REGISTRY.md` lines 8-13 reference `agents/may/handlers/run-workflow.ts` as the guard consumer and show an import path that no longer exists:

```markdown
Guards are dynamically loaded by `loader.ts` and wired into the workflow engine
(`agents/may/handlers/run-workflow.ts`). The loader imports every `.ts` file in this
directory (except `loader.ts` itself) and collects exports matching `{ guard: WorkflowGuard }`.

```ts
import { loadGuards, runGuards } from "../../shared/guards/loader.js";
```
```

The file `agents/may/handlers/run-workflow.ts` does not exist (deleted in commit `05c65fea6` — "refactor: make projects first-class app folders"). Guards are now loaded by `projects/may-agent/src/lib/workflow-tool.ts` (line 881).

## Proposed Change

Replace the "Loading" section (lines 6-13) with:

```markdown
## Loading

Guards are dynamically loaded at workflow runtime via `loadGuards()` in
`projects/may-agent/src/lib/workflow-tool.ts`. The loader scans configured
guard directories for `.ts` files (excluding `.test.ts`, `.disabled.ts`, and
files starting with `REGISTRY`), imports each, and collects exports matching
`{ guard: WorkflowGuard }`. Guards can be disabled at runtime via the
`DISABLED_GUARDS` environment variable (comma-separated guard names).
```

## Risk

Minimal. Pure documentation fix. No runtime behavior changes.

## Validation

After change: `grep "agents/may/handlers" shared/guards/REGISTRY.md` should return nothing.
