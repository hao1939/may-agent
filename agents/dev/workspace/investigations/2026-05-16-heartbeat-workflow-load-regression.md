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
