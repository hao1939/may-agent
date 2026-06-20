---
id: KE-2073
title: "Guards REGISTRY.md References Deleted agents/may/handlers/run-workflow.ts — Consumer Moved to workflow-tool.ts"
date: 2026-06-20
author: arc
status: active
tags: [coherence, guards, stale-path, documentation-drift, architecture]
related: [KE-2050, KE-720, KE-1549]
last_verified: 2026-06-20T08:13Z
---

<ai_context>
summary: "shared/guards/REGISTRY.md line 9 states guards are 'wired into the workflow engine (agents/may/handlers/run-workflow.ts)' and line 13 shows an import path '../../shared/guards/loader.js'. The file agents/may/handlers/run-workflow.ts no longer exists (deleted during the projects-first-class refactor, commit 05c65fea6). The actual guard loading now happens at projects/may-agent/src/lib/workflow-tool.ts line 881 via loadGuards(). The shared/guards/loader.ts file still exists and works correctly — only the REGISTRY.md documentation of the consumer path is stale. The loader.ts file also has its own loadGuards() function but that appears to be a separate export for potential external use; the runtime uses the one in workflow-tool.ts. Impact: agents investigating guard behavior will look for a non-existent file. Low severity since guards themselves work fine."
triggers: [guards documentation stale path, REGISTRY.md audit, coherence check]
falsifiers:
  - F1: "If REGISTRY.md is updated to reference the correct path (projects/may-agent/src/lib/workflow-tool.ts), the stale reference is resolved." — Check file content after edit.
  - F2: "If agents/may/handlers/run-workflow.ts is recreated or re-linked, the reference becomes valid again." — Check git log for any restoration.
  - F3: "If the loader.ts file in shared/guards/ is still the actual import target used by workflow-tool.ts, the stale import example '../../shared/guards/loader.js' is also wrong (relative path from deleted location)." — Cross-check the actual import in workflow-tool.ts.
</ai_context>

# KE-2073: Guards REGISTRY.md Stale Path to Deleted run-workflow.ts

## Observation

`shared/guards/REGISTRY.md` lines 8-13:

```
Guards are dynamically loaded by `loader.ts` and wired into the workflow engine
(`agents/may/handlers/run-workflow.ts`). The loader imports every `.ts` file in this
directory (except `loader.ts` itself) and collects exports matching `{ guard: WorkflowGuard }`.

```ts
import { loadGuards, runGuards } from "../../shared/guards/loader.js";
```

**Problem**: `agents/may/handlers/run-workflow.ts` does not exist (exit code 2 on `ls`).

## Where Guards Actually Load

The guard loading is now at `projects/may-agent/src/lib/workflow-tool.ts`:
- Line 308: `export async function loadGuards(...dirs: (string | undefined)[]): Promise<WorkflowGuard[]>`
- Line 881: `const guards = await loadGuards(opts.guardsDir, opts.sharedGuardsDir);`

This file contains its own `loadGuards` implementation (not importing from `shared/guards/loader.ts`). The `shared/guards/loader.ts` file still exists but appears to be a separate/redundant implementation.

## Git History

The deletion happened during the projects-first-class refactor:
```
05c65fea6 refactor: make projects first-class app folders
```

The `REGISTRY.md` was last updated for a different reason (marking verify-after-write as disabled):
```
fdece21df fix: mark verify-after-write as disabled in guard REGISTRY.md
```

## Impact

- **Low severity**: Guards function correctly; only documentation is stale
- **Agent confusion**: Any agent investigating guard system will look for a non-existent file
- **Import example is wrong**: The relative path `../../shared/guards/loader.js` makes no sense from the new location
- **24 references across the codebase** point at the old path (mostly in investigation notes/workspace files — also stale)

## Resolution

REGISTRY.md line 9 should reference the actual consumer: `projects/may-agent/src/lib/workflow-tool.ts`. The import example on line 13 should either be removed or updated to show the actual pattern. This file is outside arc's edit lane — proposal filed.
