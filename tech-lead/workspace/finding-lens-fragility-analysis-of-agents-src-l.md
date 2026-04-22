# Fragility Analysis: run-workflow.ts

**File**: `agents/may/handlers/run-workflow.ts` (236 lines)
**Context**: Commit `45c880ada` reverted a cache-busting change that copied workflow files to temp — broke relative imports.

## Fragile Assumptions

### 1. `?t=` query param cache-busting may not work (MEDIUM)
**Location**: `run-workflow.ts:51` — `await import(filePath + "?t=" + ++importCounter)`

The current approach appends `?t=N` to the file path for dynamic imports. This is the fallback after the temp-copy approach was reverted. The comment in the reverted commit says "Bun compiled binaries cache dynamic imports even with ?t= query params." If Bun ignores query params for `.ts` file imports, **every workflow invocation after the first loads stale code**. The `?t=` trick works in browsers/Vite but may not in Bun's native import system.

**Risk**: Stale workflow code runs silently after file edits.

### 2. Silent swallowing of broken workflow files (LOW)
**Location**: `run-workflow.ts:96-98` — bare `catch {}` in the `findWorkflow` loop

When iterating workflow files, any import error (syntax error, missing dependency, type error) is silently caught and skipped. If the *target* workflow file has a bug, `findWorkflow` reports "Workflow not found" instead of the actual error, making debugging very hard.

### 3. Deep relative import paths create coupling to directory structure (MEDIUM)
**Location**: `run-workflow.ts:30-37` — imports like `../../../src/lib/handler-context.js`

Six imports use `../../../src/lib/` paths (lines 30-37). Any restructuring of the directory tree breaks all of them. This is what made the temp-copy approach fail — copying the file to `/tmp` made these `../../..` paths unresolvable.

### 4. `getWorkflowDir` is an opaque dependency with no fallback (LOW)
**Location**: `run-workflow.ts:131` — `ctx.manager.getWorkflowDir(agent)`

The handler trusts `ctx.manager.getWorkflowDir()` to return a valid directory but only logs and returns silently on `undefined` (line 132-134). The workflow silently does nothing — no error thrown, no status recorded, the `WorkflowRun` record is never created.

### 5. Module-level mutable counter for import deduplication (LOW)
**Location**: `run-workflow.ts:45` — `let importCounter = 0`

The `importCounter` is module-scoped and never reset. In long-running processes this is fine, but if the module is re-imported (e.g., during the temp-copy scheme), the counter resets to 0, potentially colliding with cached imports.

## Hardening Recommendations (Top 3)

### R1: Replace `?t=` with a robust cache-bust strategy
Instead of query params (unreliable in Bun) or temp-copy (breaks relative imports), use `file://` URLs with a hash fragment, or clear Bun's module cache if an API exists. Alternatively, accept that workflows are loaded once and require a process restart for code changes — document this explicitly.

### R2: Log errors in the `findWorkflow` catch block
At `run-workflow.ts:96`, change `catch {}` to `catch (err) { ctx.log(...) }` (or at minimum, collect errors). If no workflow matches, include the collected errors in the thrown exception so the real problem is visible.

### R3: Extract shared types to a package path alias
The six `../../../src/lib/` imports (`run-workflow.ts:30-37`) should use a path alias (e.g., `@agents/lib/...`) in tsconfig. This eliminates the fragility that killed the temp-copy approach and makes the file relocatable.

## Can Any Assumptions Be Eliminated?

Yes — **Assumption #3 (deep relative imports) can be eliminated entirely** with a tsconfig path alias. This would also re-enable the temp-copy cache-busting strategy (Assumption #1) since copied files could resolve `@agents/lib/...` regardless of their physical location.
