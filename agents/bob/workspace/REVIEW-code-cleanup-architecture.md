# Code Cleanup Architecture Review

**Author**: Bob  
**Date**: 2026-04-08  
**Status**: Ready for implementation

---

## 1. Fix Eager vs Lazy `requests.ts` Import Conflict

### Current State

`manager.ts` imports `requests.ts` **both** eagerly and lazily in the same file:

```ts
// Line 53 — EAGER (top-level)
import { getDb, updateSessionDb } from "./requests.js";

// Lines 87-98 — LAZY (async wrapper)
let _requestsMod: typeof import("./requests.js") | null = null;
async function getRequestFns() { ... }
```

The lazy pattern exists in 4 files, always with the same comment: *"uses bun:sqlite, not available in vitest"*:

| File | Pattern | What it imports |
|------|---------|----------------|
| `manager.ts` | **Both** eager + lazy | `getDb`, `updateSessionDb` (eager); full module (lazy) |
| `manager-agents-tool.ts` | Lazy only | Full module via `getRequestsModule()` |
| `tools/lifecycle.ts` | Lazy only | `updateRequest` via `getUpdateRequest()` |
| `session-subscribers.ts` | Inline lazy | `import("./requests.js")` in event handlers |

Meanwhile, **12+ other files** import `requests.ts` eagerly with no issues:
`evaluator.ts`, `auto-pause.ts`, `db-writer.ts`, `session-digest.ts`, `manager-health.ts`, `cron.ts`, `agent-loader.ts`, `chat-session.ts`, `cli-send.ts`, `may.ts`, `send-tool.ts`, `request-status.ts`, `system-status.ts`

### Analysis

The lazy pattern was introduced because `requests.ts` transitively imports `bun:sqlite` (via `db.ts`), and vitest runs under Node where `bun:sqlite` is not available. However:

1. **`db.ts` already handles this.** It has runtime detection (`detectRuntime()`) and falls back to `node:sqlite` when Bun is unavailable. The `require("bun:sqlite")` in `db.ts` only executes when the runtime is detected as Bun.

2. **The eager import on line 53 of `manager.ts` contradicts the lazy import on line 87.** If `bun:sqlite` really weren't available, the eager `import { getDb, updateSessionDb }` would blow up at module load time — before the lazy wrapper ever gets called. The fact that tests pass proves the eager import works fine.

3. **12+ files import eagerly with no vitest issues.** This is strong evidence the lazy pattern is a vestigial workaround from before `db.ts` had dual-runtime support.

4. **The lazy pattern adds complexity for zero benefit:** async wrappers, null checks, `try/catch` blocks that silently swallow errors, and subtle bugs (if the lazy import fails, request tracking silently stops working with no error visible to the caller).

### Recommendation: **Always eager. Remove all lazy wrappers.**

**Rationale:**
- `db.ts` already abstracts the runtime difference (bun:sqlite vs node:sqlite)
- The eager import in `manager.ts` line 53 already proves this works
- Removing lazy wrappers eliminates 4 patterns of async indirection, ~40 lines of boilerplate, and silent failure modes
- No circular dependency risk: `requests.ts` imports from `db.ts` and `classify-error.ts` — neither imports back from `manager.ts`

**Specific changes:**

1. **`manager.ts`**: Remove lines 87-98 (`_requestsMod` + `getRequestFns`). Change the one call site (line 771, `escalateBlockedSession`) to use `trackRequest` imported eagerly at the top alongside `getDb` and `updateSessionDb`.

2. **`manager-agents-tool.ts`**: Remove lines 19-25 (`_requestsModule` + `getRequestsModule`). Add eager import at top. All call sites that do `const mod = await getRequestsModule()` become direct function calls.

3. **`tools/lifecycle.ts`**: Remove lines 30-39 (`_updateRequestFn` + `getUpdateRequest`). Add `import { updateRequest } from "../requests.js"` at top.

4. **`session-subscribers.ts`**: Replace inline `import("./requests.js").then(mod => ...)` with eager imports at top. The event handlers become synchronous (they're already fire-and-forget with `.catch(() => {})`).

### Risks

- **None identified.** The only risk was vitest compatibility, which is already solved by `db.ts` dual-runtime support. The eager import on `manager.ts:53` has been working in both production and tests.
- If somehow a future test environment lacks both `bun:sqlite` AND `node:sqlite`, `db.ts` would throw at module load — but that's the correct behavior (fail fast) vs the current silent failure.

---

## 2. Simplify `loaded` Array in `resolveSystemPrompt`

### Current State

In `resolveSystemPrompt` (manager.ts ~line 442):

```ts
const loaded: string[] = ["SOUL.md"];
if (loaded.length > 0) {
  envLines.push(`- Already in context (do NOT re-read): ${loaded.join(", ")}, common-sense.md, skills/*.md`);
}
```

This is a vestigial pattern. The `loaded` array:
- Is initialized with a hardcoded `["SOUL.md"]`
- Never has anything added to it dynamically
- Is immediately checked (`loaded.length > 0`) — which is always true since it's initialized with one element
- The `if` guard is dead code
- `common-sense.md` and `skills/*.md` are hardcoded as string literals appended AFTER the `.join()`, not tracked in the array at all

### History

This array likely existed when the system prompt dynamically loaded optional files (context.md, memory, etc.) and needed to track what was included to tell the agent "don't re-read these." Those files have since been moved to `buildSessionContext()` (first user message, per P147 KV-Cache Discipline), so the tracking became unnecessary.

### Recommendation: **Replace with a static string. Remove the array entirely.**

The entire block:
```ts
const loaded: string[] = ["SOUL.md"];
if (loaded.length > 0) {
  envLines.push(`- Already in context (do NOT re-read): ${loaded.join(", ")}, common-sense.md, skills/*.md`);
}
```

Should become:
```ts
envLines.push(`- Already in context (do NOT re-read): SOUL.md, common-sense.md, skills/*.md`);
```

**Rationale:**
- The list of loaded files is determined by the code above it in `resolveSystemPrompt`: it always loads SOUL.md, common-sense.md, and skills/*.md (if they exist). There's nothing dynamic about this.
- Removing the array eliminates the misleading suggestion that this is a tracking mechanism.
- The `if` guard was always true — dead code.

### Risks

- **Minimal.** If someone adds a new optional file to the system prompt in the future, they'd need to add it to the static string. But that's obvious from reading the code — and better than the current state where the array gives the illusion of dynamic tracking without actually doing it.
- The agent gets told "SOUL.md, common-sense.md, skills/*.md are already in context" regardless of whether those files actually existed on disk. This is technically the same behavior as before (the array always contained "SOUL.md" even if the file didn't exist). If we wanted to be precise, we could conditionally include only files that were actually found — but that's a separate enhancement, not a simplification.

---

## Summary

| Item | Recommendation | Complexity | Risk |
|------|---------------|-----------|------|
| Eager vs lazy requests.ts | Always eager, remove lazy wrappers | Low (4 files, ~40 lines removed) | None — already proven by existing eager imports |
| `loaded` array | Replace with static string | Trivial (3 lines → 1 line) | None |

Both changes are safe mechanical refactors. No behavioral change, no new dependencies, no test updates needed (existing tests already exercise the eager path).
