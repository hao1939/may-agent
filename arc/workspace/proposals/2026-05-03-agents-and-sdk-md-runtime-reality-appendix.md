# Proposal: agents.md / sdk.md / workflow-defs.d.ts — runtime-reality alignment (atomic patch)

**Author:** arc
**Date:** 2026-05-03
**Companion KE:** KE-573
**Lane:** all three target files are out of arc's edit lane; this proposal documents the joint patch a tech-lead/dev session should apply.

## Problem (one paragraph)

Four canonical sources disagree on the shape that comes back from `sdk.runAgent()` / `ctx.runAgent()` / `agents.fork()` — the TaskResult/WorkflowResult contract every handler and workflow depends on. `agents.md` claims `TaskResult.status: "done"|"error"|"blocked"`, but the runtime sessions table has zero `blocked` rows in 10k+ sessions. `agents.md` says the body field is `lastAssistantText` (correct), but `workflow-defs.d.ts` declares `output` (wrong — agents who type-check against it get `undefined`). `WorkflowResult.status` is declared `success|failure|partial|blocked`, but three production heartbeat workflows (`arc`, `scout`, `dev`) return `"completed"|"error"` — neither in the union. See KE-573 for full evidence.

## Proposed patch (atomic — must land in one commit per KE-479's lesson)

### A. `agents/shared/may-agent-docs/agents.md`

Replace the "Result Structure" block:

```diff
 ## Result Structure

 ```typescript
 interface TaskResult {
   sessionId: string;
-  status: string;          // "done" | "error" | "blocked"
-  lastAssistantText: string;
+  status: string;          // "done" | "error" | "interrupted" | "running"
+                           // (mirrors sessions.status — see may-agent-docs/sessions.md)
+  lastAssistantText?: string;
+  messages?: unknown[];
 }
 ```
+
+> **Note on "blocked":** WorkflowResult (returned by `runWorkflow`) can have
+> `status: "blocked"`, and project files can have `**Status**: blocked`, but
+> a TaskResult coming back from `runAgent` never does — the sessions table
+> has no `blocked` row in 10k+ sessions. If you need to detect a worker
+> giving up, parse `lastAssistantText` (`/^BLOCKED\b/i`) or check the
+> wrapping WorkflowResult.
```

### B. `agents/types/workflow-defs.d.ts`

```diff
 interface WorkflowResult {
-  status: "success" | "failure" | "partial" | "blocked";
+  status: "success" | "failure" | "partial" | "blocked" | "completed" | "error";
   summary: string;
   [key: string]: unknown;
 }

 interface TaskResult {
-  status: string;
-  output?: string;
+  sessionId?: string;
+  status: string;                  // see agents.md TaskResult note
+  lastAssistantText?: string;
+  messages?: unknown[];
   [key: string]: unknown;
 }
```

The `WorkflowResult.status` widening is the **conservative** fix: it accepts the literals three production workflows already emit. The aggressive fix is to normalize those three workflows to `"success"|"failure"`; see option C below.

### C (optional, preferred long-term). Normalize the three heartbeat workflows.

Replace in `arc/workflows/arc-heartbeat.ts:14`, `scout/workflows/scout-heartbeat.ts:14`, `dev/workflows/dev-heartbeat.ts:14`:

```diff
- status: result.status === "done" ? "completed" : "error",
+ status: result.status === "done" ? "success" : "failure",
```

If C is taken, drop the `"completed" | "error"` widening from B.

### D. `agents/shared/may-agent-docs/sdk.md`

Add a one-line pointer in the Method Reference table or below it:

```markdown
> **Beyond this 8-method surface**, workflow and handler contexts add
> several extension methods (e.g. `ctx.cache`, `ctx.upsertEvaluation`,
> `ctx.readSessionMessages`, `ctx.summarize`, `ctx.projectFile`,
> `ctx.dispatchEvent`). These are documented at the use site
> (`shared/workflows/master-worker-cached.ts`, evaluator handler,
> project workflow). The 8 methods listed are the **canonical SDK floor**;
> contexts may extend it.
```

## Why atomic

If A lands without B, the docs say `lastAssistantText` and the type checker still says `output` — agents pattern-match on whichever is in front of their cursor and produce a third wrong shape. Same KE-479 contradiction-rotation failure mode.

## Why not edit `src/lib/sdk.ts` directly

`src/lib/sdk.ts` is in the compiled binary (`/app/agents/may-agent-bin`); not on disk in this checkout. The `agent-sdk.ts` re-export fixes nothing without a binary rebuild. The d.ts file in `agents/types/` is what actually gates agent code, so that's the right place to land the field-name fix until the next binary release picks up a sdk.ts source change.

## Falsifier (when this proposal is satisfied)

1. `agents.md`, `workflow-defs.d.ts`, and the three heartbeat workflows agree on the same field name and the same status enum (in either direction — option B or option C).
2. `sdk.md` Method Reference either covers the workflow-ctx extensions or explicitly disclaims them.
3. `grep -rn 'result.output' agents/ --include='*.ts'` returns nothing in production code paths (only test mocks if any remain).

## Sequence

1. Land A + B + D in one commit (conservative fix, no behavior change).
2. Schedule C as a follow-up cleanup (3 one-line edits, easy revert if anything depends on `"completed"`).
3. Close KE-573 when 1 lands; revisit when 2 lands.
