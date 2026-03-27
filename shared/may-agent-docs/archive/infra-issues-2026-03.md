# Infrastructure Issues

> **Archive**. All issues below were resolved during V1. Some referenced code
> (`createTool`, `send()`, `subagents` tool) no longer exists in V2. The
> `agents` tool replaced `subagents`, and cascading cancel, graceful shutdown,
> and workflow resume are all still in the codebase.

Tracked issues for may-agent infrastructure improvements.

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done

---

## 1. Parallel Async: `waitForAll` / `waitForAny`

**Status:** `[ ]` — Low priority, deferred

**Problem:** The subagent tool supports two modes today:
- **Sync** (`delegate`): run + wait in one call. Blocks the parent.
- **Async** (`run` + `waitFor`): fire, then block on one session.

There's no way to run N sessions in parallel and collect results efficiently. An agent that wants to run 3 coders in parallel must call `waitFor` 3 times sequentially — it can't say "run 3, tell me when all/any finish."

**Proposed fix:**
- Add `waitForAll(sessionIds)` → waits for all, returns results in order
- Add `waitForAny(sessionIds)` → waits for first to finish, returns its result
- Add corresponding `sessionIds` parameter to the tool schema
- `waitForAny` does NOT cancel remaining sessions — caller decides

**Files:** `src/manager.ts` (methods + createTool schema/cases)

---

## 2. Stale Workflow Run Cleanup

**Status:** `[x]`

**Problem:** When the process dies hard, workflow run records stay `status: "running"` on disk forever.

**Solution implemented:** Added `cleanupStaleWorkflowRuns()` private method that scans `workflows/*.json` and marks any `"running"` runs as `"interrupted"` with `endedAt` and reason. Called from `cleanupStaleSessions()` and all return paths of `resumeAgent()`.

**Files:** `src/manager.ts`, `test/stale-workflow-runs.test.ts`

---

## 3. Interrupted Workflow RunId Bug

**Status:** `[x]`

**Problem:** When a workflow was interrupted via steering, the tool result reported `workflowRunId: "unknown"` because `WorkflowInterrupted` didn't carry the run ID.

**Solution implemented:**
- Added `workflowRunId` parameter to `WorkflowInterrupted` constructor (default `"unknown"` for backward compat)
- Pass `runId` at all 3 throw sites in `executeWorkflow()`
- Use `err.workflowRunId` in both catch handlers (run + resume actions) instead of `"unknown"`

**Files:** `src/workflow.ts`, `src/workflow-tool.ts`

---

## 4. Graceful Shutdown

**Status:** `[x]`

**Problem:** SIGINT/SIGTERM killed the process immediately. Running sessions became stale orphans. Also, `cancel()` didn't cascade to child sessions, and `createTool`'s `run`/`delegate` actions didn't set `parentSessionId`.

**Solution implemented:**
- `cancel(sessionId)` now cascades: finds all active children by `parentSessionId` and cancels them recursively (depth-first) before aborting the target
- `createTool` accepts `getCallerSessionId` callback; `run` and `delegate` actions pass `parentSessionId` via `RunOptions`, so all sub-sessions are linked to their parent
- `run/may.ts` registers SIGINT/SIGTERM handlers that call `manager.cancel(sid)` (cascades to all children), then exits after 2s grace period
- `run/socket-ui.ts` signal handlers no longer call `process.exit()` — they just clean up the socket; shutdown is owned by `may.ts`

**Files:** `src/manager.ts` (cascading cancel, createTool getCallerSessionId), `run/may.ts` (graceful shutdown), `run/socket-ui.ts` (removed process.exit from signal handlers)

---

## 5. Unhandled `status` Command

**Status:** `[x]`

**Problem:** The `RunnerCommand` type included `{ type: "status" }` but the `onCommand` handler in `run/may.ts` didn't handle it.

**Solution implemented:** Added `status` case that emits an info event listing all active sessions (agent, sessionId, status, task, runtime).

**Files:** `run/may.ts`

---

## 6. Workflow Resume

**Status:** `[x]`

**Problem:** If a workflow was mid-execution when the process crashes, the workflow execution context is lost. May's session can be resumed via `resumeAgent("may")`, but the workflow is dead.

**Solution implemented:** Replay-based resume. The workflow tool has a new `resume` action that takes a `workflowRunId`. On resume:
- `executeWorkflow` accepts an optional `previousRun: WorkflowRun`
- `runAgent` uses a call counter; if the step index has a completed step in the previous run, returns the archived `TaskResult` via `manager.result(sessionId)` instead of spawning a new session
- At the first step where the archived agent name doesn't match the current call, replay stops and live execution begins (detects workflow code changes)
- The new run records `resumedFromRunId` pointing to the previous crashed run
- `WorkflowRun` has a new optional `resumedFromRunId` field

**Guard:** If the workflow code changed between crash and restart (detected by agent name mismatch at any step), replay stops and all remaining steps run fresh.

**Files:** `src/workflow-tool.ts`, `src/persistence.ts` (WorkflowRun type), `test/workflow-resume.test.ts`

---

## 7. `send()` Dead Code

**Status:** `[x]`

**Problem:** `send()` only worked on active sessions that were not running, but `handleCompletion()` removed sessions from `activeSessions` immediately on completion. No window for `send()` to operate.

**Solution:** Removed `send()` entirely. Multi-turn inter-agent conversation would need a proper design (session restoration from archive). For now, agents are one-shot: `run()` starts them, `steer()` redirects mid-run, `waitFor()` collects results.

**Files:** `src/manager.ts`, `docs/design.md`, `test/send-persistence.test.ts`, `test/send-and-accessors.test.ts`, `test/edge-cases.test.ts`, `test/max-turns.test.ts`

---

## Non-Issues (Audited, No Action Needed)

- **Memory and context:** Solid. JSONL append, memory in system prompt, compaction works.
- **Event bus / UI:** Solid. Console and socket UI both work. Event types are comprehensive.
- **Session persistence:** Solid. JSONL per-session, atomic registry writes, archive/restore.
- **Session tracing:** Solid. `trace()` builds the full session graph from workflow run records.
- **Skills system:** Solid. SKILL.md discovery, frontmatter parsing, prompt injection.
- **Turn limit enforcement:** Solid. Tracks via turn_end events, aborts cleanly.
- **Timeout enforcement:** Solid. Timer-based, cleared on completion.
