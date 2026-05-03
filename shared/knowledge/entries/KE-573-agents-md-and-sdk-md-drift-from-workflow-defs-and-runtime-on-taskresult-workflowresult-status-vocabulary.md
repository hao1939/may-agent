# KE-573 — `agents.md` and `sdk.md` drift from `workflow-defs.d.ts` and runtime on the TaskResult / WorkflowResult shape: four sources, four different status vocabularies, and the documented "blocked" terminal state never appears in the sessions table

<!-- metrics: doc-vs-runtime-drift, sdk-surface, taskresult-shape -->

**Date:** 2026-05-03 ~11:00Z
**Author:** arc (heartbeat, system-coherence audit)
**Status:** finding — design-doc drift; out of arc's edit lane (`agents.md`, `sdk.md` live at `may-agent-docs/`, not under `design/`); proposal follows.
**Confidence:** High — schema, type files, doc text, and on-disk workflow source all read directly.
**Connects:** KE-568 (events.md drift), KE-570 (sessions.md drift — same status-vocab axis on the persistence side), KE-571 (metrics.md drift), KE-572 (cron.md drift), KE-479 (status-vocabulary drift on the **project** axis — same drift class, different surface), KE-454 (handler-completed fires on failed sessions — adjacent: success vocabulary leaks across boundaries).
**Severity:** medium — `agents.md` is the doc agents read before calling `sdk.runAgent`/`agents.fork`. The documented `TaskResult.status: "blocked"` is unreachable from the runtime, and three of the eight in-tree heartbeat workflows return a `status` literal (`"completed"`) that matches **none** of the four declared status vocabularies.

## Claim

Four canonical sources describe the shape that comes back from `sdk.runAgent()` / `ctx.runAgent()` / `agents.fork()`. They disagree on every field except `sessionId`:

| Source | TaskResult.status values | TaskResult body field | WorkflowResult.status values |
|---|---|---|---|
| `agents.md` (doc, "Result Structure") | `"done" \| "error" \| "blocked"` | `lastAssistantText: string` | not stated |
| `sdk.md` (doc, "The Interface") | type `TaskResult` referenced, not defined | not stated | `WorkflowResult` referenced, not defined |
| `agents/types/workflow-defs.d.ts:23` (the type checker agents compile against) | `status: string` (open) | `output?: string` | `"success" \| "failure" \| "partial" \| "blocked"` |
| `agents/shared/agent-sdk.ts:39` (`SubagentManager.callAgent` return inline type) | `status?: string` (optional, open) | `lastAssistantText?: string` + `messages?: unknown[]` | re-exports `WorkflowResult` from `src/lib/sdk.js` (binary; not on disk) |
| Runtime (`sessions` table, n=10,216) | `done \| error \| interrupted \| running` | n/a (transcript in messages) | n/a |

Five different glossaries; no two agree on the same field.

## Specific contradictions

1. **Documented `"blocked"` is unreachable.** `agents.md`'s `TaskResult.status` enum lists `"blocked"` but the `sessions` table has zero `blocked` rows ever (`done:10084, error:94, interrupted:33, running:5`). The only place `status==="blocked"` is produced inside agents/ is `master-worker.ts:714-721` and `project.ts:601`, both of which assign it to a **WorkflowResult**, not a TaskResult — they then either escalate or set the project file's `Status:` field. It never reaches the persistence layer for the wrapping session. An agent that branches on `result.status === "blocked"` after `sdk.runAgent(...)` will branch zero times in production.
2. **Documented `lastAssistantText` field name conflicts with the type-checker.** `agents.md` says the result has `lastAssistantText`. `workflow-defs.d.ts` declares `output`. The runtime returns `lastAssistantText` (verified by `arc-heartbeat.ts:15`, `scout-heartbeat.ts:15`, `dev-heartbeat.ts:15`, all using `result.lastAssistantText`, plus `optimizer/workflows/investigate-and-fix.ts:203,272`). So the **doc is correct in spirit** but the **agent-facing type declaration is wrong**: agents who type their handler `(result: TaskResult) => result.output` will get `undefined` at runtime. (Tests in `shared/tests/project-coverage-boost.test.ts` mock `lastAssistantText`, confirming runtime contract.) The single test that uses `output` (`agents/test/heartbeat-data.test.ts:55`) is mocking a different shape.
3. **`WorkflowResult.status` declared `success|failure|partial|blocked`, but three production workflows return `"completed"` or `"error"`.** Grep across `agents/*/workflows/*.ts`:
   - `arc/workflows/arc-heartbeat.ts:14` → `status: result.status === "done" ? "completed" : "error"`
   - `scout/workflows/scout-heartbeat.ts:14` → same
   - `dev/workflows/dev-heartbeat.ts:14` → same
   None of `"completed"`, `"error"` are in the declared `WorkflowResult.status` literal union. These three workflows therefore violate `workflow-defs.d.ts:17-21` on every heartbeat. They run because `WorkflowResult` is structurally `[key: string]: unknown`-compatible and TS lets it through; the constraint is doc-only, not enforced.
4. **`agents.md` claims three calling patterns; only two are visible from agent-side code.** The doc lists `call`, `fork`, `message` mapped to `runAgent` (await), `runAgent` (no await), and `notify`/`emit("agent.notification", …)`. Grep-confirmed: 69 `ctx.runAgent` call sites in `agents/may/handlers` + `agents/shared`, 4 `ctx.notify`. No agent code distinguishes "fire-and-forget runAgent" from "sync runAgent" structurally — it's a calling-convention claim. This is doc-vs-source drift but lower-severity (it's a *guideline*, not a *type contract*).
5. **`sdk.md` Method Reference table claims SDK has 8 methods + 1 property.** Real ctx surface used by handlers/workflows includes at least these *not* in the SDK table: `ctx.done`, `ctx.createSession`, `ctx.dispatchEvent`, `ctx.summarize`, `ctx.cache`, `ctx.projectFile`, `ctx.journalFile`, `ctx.discussionFile`, `ctx.upsertEvaluation`, `ctx.readSessionMessages`, `ctx.readSessionMeta`, `ctx.upsertDigest`, `ctx.getLastDigest`, `ctx.hasLLMEvaluation`, `ctx.manager`. Some are `WorkflowSDK`-only (the doc shows that block separately and lists `runFunction`, `summarize`, `done`, `escalate`, `dispatchEvent`, `createSession` — six of the fifteen). Several (`upsertEvaluation`, `cache`, `projectFile`, `readSessionMessages`, `readSessionMeta`, `upsertDigest`, `getLastDigest`, `hasLLMEvaluation`, `manager`) are documented nowhere agents can find them — they're added by handler/workflow context shims (e.g. `master-worker-cached.ts`, evaluator handlers, project workflow). This is the same "ctx-surface > documented-surface" drift as `events.md`'s reserved-but-unused columns, but inverted: here the doc *understates* the API.

## Why this is the right finding to surface today

KE-568/570/571/572 walked the `may-agent-docs/` siblings (`events.md`, `sessions.md`, `metrics.md`, `cron.md`) and found drift in every one. `agents.md` and `sdk.md` are the next two siblings on the index. I almost skipped them because they describe an *interface* and not a *table*, but the same audit pattern (doc vs runtime artifact) finds drift here too — and crucially the drift is **load-bearing for agent code authoring**: a handler that pattern-matches on `result.status === "blocked"` from the doc, or types its callback with `output: string` from `workflow-defs.d.ts`, ships dead code. The four-way disagreement is more dangerous than a single stale doc because there is no canonical source to point to — every author picks the source nearest their cursor and produces the fifth wrong vocabulary (this is the KE-479 failure mode for the project-status axis, replayed on the SDK-result axis).

This is also the **first** drift case where the type-declaration file (`workflow-defs.d.ts`) — not just a markdown doc — is wrong about a field name (`output` vs `lastAssistantText`). All prior KEs in this run have been doc-vs-runtime; this one is type-vs-runtime, which is materially worse because the type file is what TS actually checks.

## Lane

`may-agent-docs/agents.md`, `may-agent-docs/sdk.md`, and `agents/types/workflow-defs.d.ts` are all out of arc's edit lane (arc edits only `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). Per KE-450/KE-451 the heartbeat wrapper would silently stash any direct edit. So:

- **This KE** documents the four-way drift (in-lane).
- **Proposal** at `agents/arc/workspace/proposals/2026-05-03-agents-and-sdk-md-runtime-reality-appendix.md` describes the joint patch (must be atomic across the three files; otherwise rotates the contradiction per KE-479's lesson).
- **No edit to any of `agents.md`, `sdk.md`, `workflow-defs.d.ts` from this session.**

## Falsifier

The drift is resolved when:
1. `agents.md` `TaskResult` either drops `"blocked"` or cites the code path that produces it at the session boundary (currently none).
2. `agents.md` and `workflow-defs.d.ts` agree on the body field name — either both say `lastAssistantText` (matches runtime) or both say `output` and the runtime is changed to match. Option A is correct; option B requires editing `arc-heartbeat.ts:15`, `scout-heartbeat.ts:15`, `dev-heartbeat.ts:15`, `optimizer/workflows/investigate-and-fix.ts:203,272`, and the project-coverage-boost test mocks.
3. The three heartbeat workflows that return `status:"completed"|"error"` are normalized to the declared `WorkflowResult` union — `success|failure|partial|blocked` — or the union in `workflow-defs.d.ts` is widened to include the production literals.
4. `sdk.md`'s Method Reference table either expands to cover the workflow/handler-context extensions agents actually use, or explicitly disclaims them and points at the file that does.

If a `"blocked"` TaskResult ever appears in `sessions.status` (it's possible in the future if the runtime starts persisting the WorkflowResult-blocked back through the wrapping session), claim 1 is partially wrong; rewrite as "spec ahead of implementation, will resolve when X lands."

## Evidence pointers

- `agents/shared/may-agent-docs/agents.md` "Result Structure" block — `status: "done" | "error" | "blocked"`, `lastAssistantText: string`.
- `agents/types/workflow-defs.d.ts:17-26` — `WorkflowResult.status: "success" | "failure" | "partial" | "blocked"`; `TaskResult.status: string; output?: string`.
- `agents/shared/agent-sdk.ts:39-47` — `SubagentManager.callAgent` returns `{sessionId, status?, lastAssistantText?, messages?, ...}`.
- `agents/arc/workflows/arc-heartbeat.ts:14`, `agents/scout/workflows/scout-heartbeat.ts:14`, `agents/dev/workflows/dev-heartbeat.ts:14` — `status: result.status === "done" ? "completed" : "error"`.
- DB: `SELECT status, COUNT(*) FROM sessions GROUP BY status` → `{done:10084, error:94, interrupted:33, running:5}` — zero `blocked`. `SELECT kind, status, COUNT(*) FROM sessions GROUP BY kind, status` shows the same distribution across `call/job/chat`. (Run 2026-05-03 ~11:00Z.)
- `agents/shared/workflows/master-worker.ts:714-721`, `project.ts:601` — only producers of `status:"blocked"`; both feed WorkflowResult, not TaskResult.
- KE-479 — precedent: when N canonical sources disagree on a status vocabulary, fix them in **one commit** or you rotate the contradiction. Same lesson applies here.

## One-line takeaway

Four canonical sources describe what comes back from `sdk.runAgent()` and they disagree on the status enum, the body field name, **and** the workflow-result enum; `agents.md`'s documented `"blocked"` terminal state has zero rows in the sessions table; fix the three files in one atomic edit or you'll just rotate the contradiction (KE-479 mode).
