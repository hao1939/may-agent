# Evaluator aftermath result-contract reliability

Date: 2026-08-20
Task: `aftermath-result-contract-reliability`

## Root cause

The affected `evaluator-aftermath` runs completed their evaluator agent session but did not leave a machine-consumable `finish().result`. The workflow previously called `ctx.agents.call("evaluator", prompt)` without an output schema, so the runtime could accept a prose-only final finish even though the prompt requested a structured result.

The common transcript sequence is:

1. The evaluator assembled a valid `kind: "evaluation"` object and made an initial structured `finish` call.
2. A completion guard resumed the session and asked it to call `finish()` again.
3. The final finish contained only `status`, prose `summary`, and verification metadata. Since the agent-call execution exposes the final result envelope, `execution.output` was absent and the prose summary could not satisfy `parseAftermathOutcome`.
4. The workflow correctly blocked rather than inventing a score, but the exact evaluation was not persisted.

Representative evidence:

- Workflow run `wr_1787257158222_nwhp` / evaluator execution `s_1787257165754_996` ended with `status=done`, while the workflow blocked with `returned no valid aftermath result`. Its transcript contains a successful structured finish at line 36 followed by the guard at line 37 and a prose-only finish at line 39; `result.json` retains only that final prose finish.
- `s_1787254210986_824` follows the same pattern: structured finish at transcript line 33, completion guard at line 34, then a final prose-only finish at line 38 after one guard-related retry.
- Runtime events contain 54 `evaluation.review_failed` rows from the bounded queried period, 52 of which are done executions classified as `no valid aftermath result`. Provider/API errors are a separate failure class and are not attributed to this result-envelope defect.

Some older executions placed JSON in `summary`; the parser keeps that legacy recovery path, but summary parsing is not a reliable completion contract and must not be the primary transport.

## Safeguard

`agents/evaluator/workflows/evaluator-aftermath.ts` now:

- defines and exports a strict TypeBox union for exactly three terminal outcomes: `evaluation`, `existing`, or `skip`;
- constrains scores, counts, verdicts, lanes, findings, non-empty identity/reason fields, and additional properties;
- passes `{ schema: aftermathOutcomeSchema }` to `ctx.agents.call`, making a schema-valid object the required agent output rather than relying on prose;
- checks that the result's evaluated `sessionId` equals the requested session before persistence;
- persists successful evaluations and structured skips as `evaluation.recorded`, including both `evaluationExecutionId` and the exact evaluated session ID;
- keeps the bounded legacy summary parser for already-produced results.

A deterministic inability to evaluate is represented by `kind: "skip"` and persisted as an `evaluation.recorded` fact with `verdict: "skipped"`, `structuredSkip: true`, `skipReason`, `aftermathVersion`, and `evaluationExecutionId`. It is not converted into a fabricated low score.

## Invalid-output and provider-failure recovery contract

If the evaluator execution is non-terminal/non-successful or its output still cannot be parsed, `reviewFailed` emits one durable `evaluation.review_failed` event before returning a blocked workflow result. The event carries:

- `source: "evaluator-aftermath"`;
- `requestedSessionId` (the evaluated-session identity);
- `executionId` (the evaluator execution identity);
- execution `status` and `summary`;
- a bounded machine-readable `reason`.

It targets `{ appId: "evaluation", project: "evaluation" }`. In `app.ts`, `evaluation.review_failed` is a declared task subscription and maps to a `project-review` input with `targetProject: "evaluation.app"`, `reason: "review-failed"`, and the original `reviewFailure` payload. This is the owner-facing recovery signal: the Evaluation App owner reviews the failure and the original `runtime/session-aftermath/<sessionId>` remains visibly blocked for reconciler-controlled retry/recovery. Remediation must not directly close, update, unblock, or recreate that `runtime/*` task; runtime task lifecycle remains reconciler-owned.

The blocked workflow also returns evidence identities `execution:<executionId>` and `status:<status>`, while successful reconciliation returns `execution:<executionId>` and `evaluated-session:<sessionId>`.

## Verification

Focused tests cover:

- schema admission of a representative successful evaluation object;
- rejection of string output by the schema, wrong-session parsing, invalid score ranges, and malformed findings;
- successful persistence with both execution and evaluated-session traceability;
- durable structured-skip persistence;
- malformed output producing a blocked result plus an `evaluation.review_failed` event that preserves requested session, execution, status, summary, reason, and Evaluation App target;
- non-done evaluator execution producing the same failure event without target-owner or human-decision side effects.

Runtime re-measurement at the time of the repair found 235 terminal `evaluator-aftermath` workflow runs after the last observed invalid-result failure (`timestamp=1787257325039`): all 235 were `done` and none were `blocked`.

### Owner re-verification — 2026-08-21

A fresh read-only runtime check expands that post-failure window to 345 successfully completed aftermath runs. Every one has an admitted terminal disposition: 307 report `Recorded aftermath evaluation for ...` and 38 report `already has durable evaluation ...`; there are no other `done` summary shapes. No later `evaluation.review_failed` event has `failure=invalid-output` or a `no valid aftermath result` reason. The 309 evaluation rows created after the cutoff contain 244 `good`, 45 `acceptable`, 19 `needs_improvement`, and one `low_quality` result. Separate evaluator executions that ended `error` or `interrupted` are not misrepresented as evaluations or skips; the workflow's review-failure branch remains the traceable non-completion path.

The newest sampled success, workflow `wr_1787316769849_pe7h`, recorded source session `s_1787316749363_155` through evaluator execution `s_1787316771549_158`. `/app/.state/sessions/s_1787316771549_158/result.json` contains the structured object under `finishParams.result`, and `evaluation.recorded` event `5907093` links the same source session and evaluator execution.

Current focused validation:

```text
bun test agents/evaluator/workflows/evaluator-aftermath.test.ts agents/evaluator/workflows/result-envelope.test.ts app.test.ts
# 35 pass, 0 fail, 131 assertions

bun run typecheck
# exit 0
```

Validation commands used for the original repair:

```text
bun test agents/evaluator/workflows/evaluator-aftermath.test.ts agents/evaluator/workflows/result-envelope.test.ts
# 17 pass, 0 fail (post-edit authoritative run)

bun x tsc --noEmit
# exit 0 in the same post-edit validation command
```
