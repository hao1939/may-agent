# Journal

### Iteration 1 — 2026-05-16T12:03:43.802Z
**Worker**: **Status:** done / finish(partial) (4m3s)

**Files modified:**
- shared/tests/workflow-handler.test.ts
- projects/evaluator-aftermath-null-trigger-loop/outputs/iteration-1-bridge-null-event-guard.md

**Files read (not modified):**
- agents/evaluator/workflows/evaluator-aftermath.ts
- agents/may/cron.json
- agents/may/handlers/run-workflow.ts
- agents/may/handlers/session-aftermath-scan.ts
- agents/dev/workspace/investigations/2026-05-15-evaluator-aftermath-null-trigger.md
- shared/agent-sdk.ts
- shared/lib/workflow-handler.ts
- agents/evaluator/workflows/evaluator-aftermath.test.ts
- package.json
- agents/package.json
- shared/tests/error-log.test.ts
- tsconfig.json
- projects/platform/repos/may-agent/test/workflow-handler.test.ts

**Commands run:**
- ✓ `cd /app && grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state "createWorkflowHandler(\|appendEvent(\|handler.workflow_dispat…`
- ✓ `cd /app && find test -maxdepth 2 -type f | sed -n '1,120p'`
- ✓ `cd /app && find . -path './node_modules' -prune -o -path './.git' -prune -o -path './.state' -prune -o -name 'vitest.config.ts' -print`
- ✓ `cd /app && find . -path './node_modules' -prune -o -path './.git' -prune -o -path './.state' -prune -o \( -path './agents/test/*' -o -name 'workflow-h…`
- ✓ `cd /app && ls -la`
- ✓ `cd /app && grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state "describe(\|it(\|expect(" shared agents | head -120`
- ✓ `cd /app && grep -RIn --exclude-dir=node_mod

_(handoff summary truncated)_
**Reviewer**: CONTINUE — [PIVOT] - **I believe**: the worker found the right failure mode but patched the wrong implementation surface; the live `evaluator-aftermath` dispatch path still escalates because `agents/may/handlers/run-workflow.ts` imports `createWorkflowHandler` from `shared/agent-sdk.ts`, which re-exports `@may-agent/sdk`, and the actual `createWorkflowHandler` used at runtime lives in `projects/platform/repos/may-agent/packages/sdk/src/index.ts`.
- **I'm uncertain about**: whether the runtime hot-reloads SDK package edits immediately or requires the normal reload cycle before DB signals change, and whether there is a second bridge caller besides `run-workflow` that also needs the same null-event guard.
- **I'd change my mind if**: we saw fresh `handler.skipped` events for `evaluator-aftermath` with reason `includeEvent requested but no event payload received`, or fresh `handler.workflow_dispatched` rows that no longer end in an immediate `evaluator-aftermath requires a sessionId` escalation after a `session.completed`.

1. **Is the goal closer?** Not yet in production behavior. We have a plausible fix shape and a passing local test, but the actual outcome metric did not improve: the 24h count is now `240`, and recent `handler.workflow_dispatched` rows for `evaluator-aftermath` are still `status='escalated'`.
2. **What did we learn?** The null-trigger theory is still correct, but the important surprise is architectural: `shared/lib/workflow-handler.ts` is not the bridge used by `run-workflow`; the active bridge is in the SDK package. So the first attempt fixed a lookalike file, not the live path.
3. **Is the current milestone the right next step?** No. We should stop treating this as “prove the null-event guard idea” and move to “patch the actual runtime bridge and add the regression test in the owning package.”
4. **Are we closing the loop?** Not yet. The first attempt fixed a symptom in a shadow implementation. The next iteration must prevent recurrence in the real shared bridge used by event-driven handlers.
5. **Is it verified?** Partially. There is a test, but it covers the wrong implementation surface. The next milestone must include a test against `projects/platform/repos/may-agent/packages/sdk/src/index.ts` or the package’s own test location.
6. **What's blocking progress?** Not external access. The blocker is internal mis-targeting: the real bridge code path is in the SDK package, and until that file is patched, runtime behavior will not change.

**(a) Concrete output:**  
Produce `projects/evaluator-aftermath-null-trigger-loop/outputs/iteration-2-sdk-bridge-fix.md` documenting:
- the import-chain evidence proving the live bridge is `projects/platform/repos/may-agent/packages/sdk/src/index.ts`,
- the exact code/test changes made there,
- targeted test results,
- a post-change DB recheck,
- and the May handoff note sent with the implementation evidence.

**(b) What's different:**  
First attempt patched a local shadow bridge in `shared/lib`. This iteration must patch the actual exported SDK bridge and its package-level regression test. That is a fundamental strategy change, not a retry.

**(c) First step:**  
Read `projects/platform/repos/may-agent/packages/sdk/src/index.ts` around `createWorkflowHandler`, then patch that implementation before touching any other file.

Additional direction:
- Mirror the same guard semantics the worker already designed: if the bridge is configured to include the trigger event, but the handler receives no event payload, skip dispatch and emit structured `handler.skipped`.
- Add/extend the regression test in the SDK-owned test surface, not only `shared/tests/`.
- After tests pass, send May a concise routing message with the evidence and note that the prior patch hit the wrong file while the live bridge owner is the SDK/workflow layer.
- Re-run the validation queries from the project after the patch lands; if the count does not move immediately, record whether fresh events at least changed shape from `workflow_dispatched -> escalated` to `handler.skipped`.

PLAN_UPDATE:
1. Confirm the failing path continues to be the event-driven `run-workflow` bridge rather than the fallback scan. ✅
2. Patch the actual live bridge implementation in `projects/platform/repos/may-agent/packages/sdk/src/index.ts` so `includeEvent` handlers skip dispatch when no event payload is present, and add regression coverage in the SDK-owned test surface.
3. Hand off implementation evidence to May for routing to the workflow owner/dev, explicitly noting that the first patch targeted `shared/lib/workflow-handler.ts` but the runtime import chain resolves through `@may-agent/sdk`.
4. Validate by rechecking 24h escalation count and recent `handler.workflow_dispatched` / `handler.skipped` rows for `evaluator-aftermath`.

CURRENT_STATE_UPDATE:
Active: the null-trigger loop is still live in production behavior.

Fresh review evidence:
- The 24h count now shows `240` evaluator-owned `escalation.created` events with reason `evaluator-aftermath requires a sessionId`.
- Recent `session.completed` events are still followed by `handler.workflow_dispatched` rows for `workflow='evaluator-aftermath'` with `status='escalated'`.
- The first implementation attempt patched `shared/lib/workflow-handler.ts`, but `agents/may/handlers/run-workflow.ts` imports `createWorkflowHandler` from `shared/agent-sdk.ts`, which re-exports `@may-agent/sdk`; the live implementation is in `projects/platform/repos/may-agent/packages/sdk/src/index.ts`.
- Fallback coverage remains healthy through `session-aftermath-scan`, so this is still a liveness/noise/waste issue rather than immediate evaluator coverage loss.

CONTEXT_UPDATE:
## Context

- The recurring escalation is caused by event-driven `evaluator-aftermath` dispatches running without a concrete trigger payload, so the workflow cannot extract `data.sessionId`.
- The live `run-workflow` bridge used by May resolves `createWorkflowHandler` through `shared/agent-sdk.ts` -> `@may-agent/sdk`, not `shared/lib/workflow-handler.ts`.
- The actual bridge implementation to patch is `projects/platform/repos/may-agent/packages/sdk/src/index.ts`.
- The first worker iteration added a good null-event guard concept and regression shape, but against the wrong file, so runtime behavior did not change.
- `session-aftermath-scan` still backfills evaluations and protects coverage while the event-driven path is noisy.

LINKED_CONTEXT_UPDATE:
## Linked Context

- `agents/dev/workspace/investigations/2026-05-15-evaluator-aftermath-null-trigger.md` — original dev investigation of the null-trigger failure mode.
- `agents/may/handlers/run-workflow.ts` — May handler showing the import path uses `createWorkflowHandler` from `shared/agent-sdk.ts`.
- `shared/agent-sdk.ts` — compatibility export proving app code resolves bridge helpers from `@may-agent/sdk`.
- `projects/platform/repos/may-agent/packages/sdk/src/index.ts` — actual live SDK implementation of `createWorkflowHandler`.
- `projects/evaluator-aftermath-null-trigger-loop/outputs/iteration-1-bridge-null-event-guard.md` — first attempt artifact; useful for guard semantics, but it targeted the wrong implementation surface.

### Iteration 2 — 2026-05-16T12:09:38.319Z
**Worker**: **Status:** done / finish(partial) (4m16s)

**Files modified:**
- projects/platform/repos/may-agent/packages/sdk/src/workflow-handler.test.ts
- projects/platform/repos/may-agent/packages/sdk/src/bun-test.d.ts
- projects/evaluator-aftermath-null-trigger-loop/outputs/iteration-2-sdk-bridge-fix.md

**Files read (not modified):**
- projects/platform/repos/may-agent/packages/sdk/src/index.ts
- agents/may/handlers/run-workflow.ts
- shared/agent-sdk.ts
- projects/platform/repos/may-agent/test/workflow-handler.test.ts
- projects/evaluator-aftermath-null-trigger-loop/outputs/iteration-1-bridge-null-event-guard.md
- agents/dev/workspace/investigations/2026-05-15-evaluator-aftermath-null-trigger.md
- projects/platform/repos/may-agent/packages/sdk/package.json
- projects/platform/repos/may-agent/src/lib/workflow-handler.ts
- projects/platform/repos/may-agent/packages/sdk/tsconfig.json
- projects/platform/repos/may-agent/tsconfig.json
- projects/platform/repos/may-agent/src/types/bun-test.d.ts
- projects/platform/repos/may-agent/packages/sdk/src/testing.ts

**Commands run:**
- ✓ `cd /app && grep -n "export interface TriggerEvent\|export interface CronEntry\|export interface AgentSDK\|export interface WorkflowHandlerOptions\|pro…`
- ✓ `cd /app && grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state "projectId:" agents/may agents/evaluator shared projects/platf…`
- ✓ `cd /app/projects/platform/repos/may-agent/packages/sdk && bun test src/workflow-handler.test.ts`
- ❌

_(handoff summary truncated)_
**Reviewer**: WAITING — the code fix is implemented and locally verified on the correct live bridge path, but the running May process has not yet picked it up. Resume when: a runtime reload/deploy picks up the patched `@may-agent/sdk` and fresh DB rows show either `handler.skipped` with reason `includeEvent requested but no event payload received` for `evaluator-aftermath`, or valid `evaluator-aftermath` dispatches with a concrete `session.completed` trigger instead of `status='escalated'`.

- **I believe**: the worker fixed the right implementation surface this time: `agents/may/handlers/run-workflow.ts` imports via `shared/agent-sdk.ts`, which re-exports `@may-agent/sdk`, and both `projects/platform/repos/may-agent/packages/sdk/src/index.ts` and `node_modules/@may-agent/sdk/src/index.ts` now contain the null-event guard.
- **I'm uncertain about**: whether the live runtime hot-reloads that SDK source automatically or needs an explicit owner-managed reload/deploy cycle before event behavior changes.
- **I'd change my mind if**: fresh DB rows after the patch still show `session.completed -> handler.workflow_dispatched(status='escalated') -> escalation.created` *after* confirmed runtime pickup, which would mean there is another active bridge/path still dispatching without an event.

1. **Is the goal closer?**  
   In production behavior, not yet. The 24h escalation count is still `240`, and recent rows still show `handler.workflow_dispatched` for `workflow='evaluator-aftermath'` with `status='escalated'`. But the codebase is closer: the fix is now on the real bridge.

2. **What did we learn?**  
   - The worker did patch the correct SDK surface this time.  
   - Local verification is strong: `bun test src/workflow-handler.test.ts` passed `3/3`, and `bun x tsc --noEmit -p tsconfig.json` exited clean in the SDK package.  
   - `node_modules/@may-agent/sdk/src/index.ts` matches the patched repo package source, so this is no longer a “wrong file” problem.  
   - The remaining gap is runtime adoption, not missing local code or test coverage.

3. **Is the current milestone the right next step?**  
   No for more worker coding. The milestone **“Patch the actual live bridge implementation in `projects/platform/repos/may-agent/packages/sdk/src/index.ts` so `includeEvent` handlers skip dispatch when no event payload is present, and add regression coverage in the SDK-owned test surface.”** is complete. The next step is owner/runtime pickup and post-pickup validation.

4. **Are we closing the loop?**  
   At code level, yes: once loaded, the correct shared bridge will stop this recurrence by skipping null-event dispatches. At production level, not yet, because the running process still appears to be executing the old behavior.

5. **Is it verified?**  
   Locally yes, production no. The regression exists in the SDK-owned test surface and passes. Runtime verification is still pending; that is now the only meaningful check left.

6. **What's blocking progress?**  
   A specific external dependency: the running May/runtime process has not yet picked up the patched SDK. The worker cannot safely force that via destructive restart actions, and I’ve already sent May the routing note with evidence.

Completed milestones to check off:
- **Patch the actual live bridge implementation in `projects/platform/repos/may-agent/packages/sdk/src/index.ts` so `includeEvent` handlers skip dispatch when no event payload is present, and add regression coverage in the SDK-owned test surface.**
- **Hand off implementation evidence to May for routing to the workflow owner/dev, explicitly noting that the first patch targeted `shared/lib/workflow-handler.ts` but the runtime import chain resolves through `@may-agent/sdk`.**

What I verified directly:
- `projects/platform/repos/may-agent/packages/sdk/src/index.ts` contains the null-event guard and `handler.skipped` emission.
- `projects/platform/repos/may-agent/packages/sdk/src/workflow-handler.test.ts` covers the missing-event skip case.
- `bun test src/workflow-handler.test.ts` passes.
- `bun x tsc --noEmit -p tsconfig.json` is clean.
- `cmp` showed the package source and `node_modules/@may-agent/sdk/src/index.ts` are identical.
- DB still shows the old live pattern, so waiting on runtime pickup is the correct state now.


### Closure — 2026-05-18

Closed by May after runtime validation confirmed the clean event trigger model is working. Current DB checks show 0 evaluator-owned `evaluator-aftermath requires a sessionId` escalations in the last hour and last 24 hours. Recent `handler.workflow_dispatched` rows for `workflow='evaluator-aftermath'` complete with `status='done'`.

The project file has been updated from stale paused/active wording to `status: done`, with the final model recorded: event data stays in `TriggerEvent.data`, workflow-specific fields such as `sessionId` are interpreted by the subscriber, and framework code does not promote domain fields onto the trigger object.
