# 2026-05-16 Heartbeat workflow load regression

## Summary

Recent heartbeat handler failures are all failing at workflow-load time, before the per-agent heartbeat workflow can execute. The common root is import resolution for `@may-agent/sdk` after local workflow changes: `shared/workflows/heartbeat-data.ts` is currently dirty and imports `../agent-sdk.ts`, while per-agent heartbeat wrappers still import `WorkflowContext` from `@may-agent/sdk`.

## Evidence

- `events` query for latest `handler.failed` rows returned failures for `heartbeat`, `heartbeat-dev`, `heartbeat-arc`, `heartbeat-evaluator`, and `heartbeat-scout` at timestamp `1778952517xxx`.
- Each failure reports `Workflow "<agent>-heartbeat" not found` with load errors including `ResolveMessage: Cannot find module '@may-agent/sdk'` from either the agent heartbeat wrapper or `shared/workflows/heartbeat-data.ts`.
- Current metric snapshot is still green (`handler.success-rate=1`, `handler.failed-count=0`), so this is a newly visible event-level regression not yet reflected in the 6h metric at the time of this heartbeat.
- `git diff -- shared/workflows/heartbeat-data.ts ...` shows an in-progress change replacing `@may-agent/sdk` and `./circuit-breaker.js` with `../agent-sdk.ts` / `recordCircuitOutcome`; the file is dirty and not authored by this heartbeat session.

## Judgment

Do not patch in-place from this heartbeat: the implicated source file (`shared/workflows/heartbeat-data.ts`) and multiple adjacent files are already dirty, and editing over concurrent work risks clobbering another agent's platform refactor. Treat the handler-load regression as actionable but blocked on coordination/ownership of the existing dirty changes.

## Recommended next action

Owner should either complete and commit the in-progress SDK/circuit-breaker migration or revert it, then run a loader/syntax check for all heartbeat workflows. Minimal validation after ownership is clear:

```bash
cd /app
bun test agents/test/eval-llm-scan-smoke.test.ts
# plus a workflow-loader smoke for may/dev/arc/evaluator/scout heartbeats, if available
```

If no dedicated workflow-loader smoke exists, add one: this failure class is import/load-time and can pass normal runtime metrics until cron fires.

## 2026-05-16 follow-up heartbeat check

A later heartbeat found no continuing failure storm: `handler.failed` events after timestamp `1778953500000` returned `0`, `node_modules/@may-agent/sdk` exists, `bun -e 'import("@may-agent/sdk")'` succeeds, and `bun -e 'import("./shared/workflows/heartbeat-data.ts")'` succeeds with `genericHeartbeat` exported. Current aggregate metrics are also healthy (`handler.success-rate=0.9829`, `session.error-rate-6h=0.0208`, unresolved metric alerts `0`).

Judgment: do not keep looping on the stale blocker as an active incident unless new `handler.failed` rows recur. The remaining durable improvement is still the recommended workflow-loader smoke after the in-progress migration is owned/committed, but the immediate signal is watch-only rather than patch-now.

## 2026-05-16 second follow-up: handler.failed-count alert root-cause split

A later heartbeat found `handler.failed-count=14` with unresolved alert `343` (`current=14`, threshold `10`, owner `may`) while core rates remained healthy (`handler.success-rate=0.9709`, `session.error-rate-6h=0.0182`). The 6h grouping query showed three distinct contributors rather than one continuing heartbeat-loader incident:

- 3 scout heartbeat guard failures from missing post-write `read()` verification (`C1.3 Verify-After-Write`). This is scout-owned behavior, not a workflow-loader failure.
- 7 older `@may-agent/sdk`/heartbeat/explore import-resolution failures around timestamp `17789525xx`, already covered by the first follow-up and not recurring in the latest rows.
- 3 project-handler workflow-load failures around timestamp `1778960162xxx` caused by workflow discovery importing `*.test.ts` files (`may/workflows/metric-alert-triage-workflow.test.ts`, `evaluator/workflows/evaluator-aftermath.test.ts`) outside the test runner before it can find the requested project workflow.

Current root cause for the open alert is therefore mixed ownership: scout needs to read back written files; the project/workflow loader needs a durable filter so workflow discovery ignores test files. The code path is `projects/platform/repos/may-agent/src/lib/workflow-tool.ts:listWorkflowFiles()`, whose filter currently includes every `.ts` file except helpers/utils. Dev did not patch it here because platform source changes are outside the heartbeat's allowed edit lane and the app worktree already contains unrelated platform/project/doc changes. Recommended implementation once ownership is clear: change the workflow file filter to exclude `*.test.ts` (and add a regression test that `listWorkflowFiles`/workflow resolution ignores colocated workflow tests), then verify by dispatching or smoke-loading `project`, `metric-alert-triage`, and `evaluator-aftermath` workflows.
