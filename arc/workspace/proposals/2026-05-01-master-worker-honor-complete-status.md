# Proposal: master-worker honors orchestrator-declared completion

**Date:** 2026-05-01
**Author:** arc
**Status:** open — needs dev review
**Refs:** KE-438 (root cause), KE-437, KE-436, KE-432, KE-429

## Problem

`master-worker.ts` cannot accept "we're done" from its own orchestrator.
Two specific lines cause this:

1. **Line 240–245**: short-circuit statuses are `paused`, `cancelled`, `closed`.
   `complete` / `done` / `finished` fall through and the workflow runs another
   iteration.
2. **Line 630**: end-of-iteration call
   `updateProjectStatus(projectFile, "active", undefined, iteration)` **unconditionally**
   overwrites whatever the orchestrator wrote — so even if an orchestrator writes
   `Status: complete`, it is gone before the next cron tick.

Result: spin loops on done projects (documentation-gen — KE-437; test-coverage
today, 31 sessions in 30 min on a project with all metrics green for hours).
This dominates `project.iterations-24h = 227` (target 10) and a non-trivial
slice of the daily compute bill.

## Proposed change

Two small edits to `agents/shared/workflows/master-worker.ts`:

### 1. Recognise completion synonyms

```ts
// around line 240–245
const TERMINAL_STATUSES = new Set([
  "paused", "cancelled",
  "closed", "complete", "done", "finished",
]);

if (status === "paused" || status === "cancelled") {
  return ctx.done(`Project status: ${status}. Skipping.`);
}

if (TERMINAL_STATUSES.has(status) && status !== "paused" && status !== "cancelled") {
  // Treat all "we're done" synonyms like `closed`: short-circuit unless there
  // are unread discussion comments to address.
  // (existing closed-with-unread-comments check)
  ...
}
```

Or even simpler: normalise `complete | done | finished → closed` once at the
top of the function and let the rest of the code stay the same.

### 2. Don't clobber terminal status at end of iteration

```ts
// line 630 — current
updateProjectStatus(projectFile, "active", undefined, iteration);

// proposed
const currentStatus = extractField(readFileSync(projectFile, "utf-8"), "Status").toLowerCase();
if (!TERMINAL_STATUSES.has(currentStatus)) {
  updateProjectStatus(projectFile, "active", undefined, iteration);
} else {
  ctx.log(`[review] Orchestrator set terminal status '${currentStatus}'; not overwriting. Loop will exit on next dispatch.`);
}
```

Either change alone breaks the spin. Both together are belt-and-braces.

### 3. (Optional, parallel) Update orchestrator system prompt

`master-worker.ts:106` currently tells the orchestrator:
> "Keep Status as: active (working), waiting (need input), or blocked (something broken)"

This omits the only statuses that actually terminate. Update to:
> "Keep Status as: active (working), waiting (need input), blocked (something broken),
>  or closed (genuinely done — all goal metrics met and no further work makes sense)."

## Risk

- Low. The change is additive on the short-circuit side, and the line-630
  change is a strict subset of current behaviour (only writes when current
  status is non-terminal — which is the only correct case anyway).
- One thing to verify: that no other path *requires* the line-630 unconditional
  write to clear a stale `blocked` (which is set on safety-cap, line 654).
  Looking at the code, `blocked` after the loop is set on the way out of the
  workflow and the workflow then exits, so the next dispatch will already see
  `blocked` and short-circuit (or escalate). The unconditional `active` write
  on line 630 actively *defeats* that safety-cap durability — see KE-437.

## Test

Add a test fixture: a `project.md` whose orchestrator output contains
"Status: complete" — assert that after one workflow iteration the project's
status is `closed` (or whichever synonym we settle on), and that the next
workflow invocation short-circuits with `ctx.done` instead of running another
orchestrator pass.

## Scope of stop-the-bleed already done

- `documentation-gen/project.md` hand-set to `closed` (KE-437)
- `test-coverage/project.md` hand-set to `closed` today (this heartbeat)

These are duct tape. The fix is in workflow code.
