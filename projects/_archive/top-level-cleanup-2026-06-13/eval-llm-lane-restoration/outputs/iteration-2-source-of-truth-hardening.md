# Iteration 2 — Source-of-truth hardening for `eval-llm-scan`

**Date:** 2026-05-13  
**Goal:** resolve the source-of-truth mismatch from iteration 1 and verify the non-heuristic evaluation lane is durable, bounded, and live without restoring the old blocking `eval-poller` behavior.

## Summary

The `eval-llm-scan` lane is present in tracked source, enabled in tracked cron configuration, covered by tests/static smoke checks, and live in runtime. The latest ingestion cycle recorded a fresh non-heuristic row at `2026-05-13 04:48:17` UTC; after the next `metrics-snapshot`, `eval.llm-coverage-lag-h.current` updated to `0.04`, below the 4h threshold.

The earlier discrepancy appears to have been stale review visibility rather than a runtime-only ghost: `git ls-files` shows the handler, cron config, workflow wrapper, and test are all tracked paths.

## Actual tracked source paths

Tracked paths found by repository search and `git ls-files`:

- Handler: `agents/may/handlers/eval-llm-scan.ts`
- Cron/registration entry: `agents/may/cron.json` entry named `eval-llm-scan`
- Workflow wrapper used for evaluator child work: `agents/shared/workflows/evaluator-deep-eval.ts`
- Unit coverage: `agents/shared/tests/eval-llm-scan.test.ts`
- Static recurrence smoke check: `agents/test/eval-llm-scan-smoke.test.ts`

Search/read-back evidence:

```text
may/cron.json
may/handlers/eval-llm-scan.ts
shared/tests/eval-llm-scan.test.ts
shared/workflows/evaluator-deep-eval.ts
```

## Registration and bounded behavior excerpts

### Cron registration

`agents/may/cron.json` has an enabled job wired directly to the handler:

```json
{
  "name": "eval-llm-scan",
  "type": "job",
  "handler": "eval-llm-scan",
  "agent": "evaluator",
  "enabled": true,
  "intervalMs": 1800000,
  "description": "Bounded non-heuristic evaluator lane. Processes at most one terminal session per run and records only validated artifacts.",
  "handlerConfig": {
    "backfillHours": 24,
    "fallbackDelayMs": 900000,
    "activeWindowMs": 1800000,
    "artifactLimit": 3
  }
}
```

This provides a durable restart/deploy registration through tracked cron config, not a runtime-only event or manual DB state.

### Candidate limit and async dispatch

`agents/may/handlers/eval-llm-scan.ts` uses the query-service scan result as a single candidate and dispatches exactly one workflow call per handler invocation:

```ts
const scan = ctx.sdk.query.evaluatorDeepEvalScan({
  now,
  backfillHours,
  fallbackDelayMs,
  activeWindowMs,
});

const candidate = normalizeCandidate(scan.candidate);
if (!candidate) {
  ctx.sdk.log("info", "[eval-llm-scan] No eligible session needs non-heuristic evaluation.");
  return;
}

ctx.sdk.runWorkflow(DEEP_EVAL_WORKFLOW, task, { source: "evaluator" })
  .then((result) => { /* emit completion trace */ })
  .catch((err) => { /* emit evaluation.deep_failed */ });

ctx.sdk.emit("evaluation.deep_dispatched", {
  source: "eval-llm-scan",
  contextSource: "query.evaluatorDeepEvalScan",
  sessionId: candidate.sessionId,
  agent: candidate.agent,
});
return;
```

The handler does **not** await the evaluator workflow. That is the main timeout-safety property: the cron handler returns after scheduling and emitting `evaluation.deep_dispatched`, so it does not repeat the old 300s blocking handler pattern.

### Active-child suppression

The handler checks for recent active deep-eval work before dispatching another candidate:

```ts
if (scan.activeDeepEval) {
  ctx.sdk.log("info", "[eval-llm-scan] Recent deep evaluation is still active; skipping dispatch.");
  return;
}
```

The tracked cron config sets `activeWindowMs: 1800000`, matching a 30-minute suppression window.

### Artifact validation before DB write

The write path only records after a session row exists, a non-heuristic row is not already present, and `readValidArtifact()` parses/validates the artifact for the expected session and agent:

```ts
function readValidArtifact(root: string, row: { sessionId: string; agent: string }): DeepEvaluation | null {
  const path = artifactPath(root, row.sessionId);
  if (!existsSync(path)) return null;
  try {
    return parseDeepEvaluationArtifact(readFileSync(path, "utf-8"), row.sessionId, row.agent);
  } catch {
    return null;
  }
}

function processArtifacts(db: any, root: string, limit: number): number {
  /* ... */
  const session = db.prepare("SELECT sessionId, agent FROM sessions WHERE sessionId = ?").get(sessionId);
  if (!session) continue;
  const alreadyDeep = db.prepare(
    "SELECT 1 FROM evaluations WHERE sessionId = ? AND evaluatedByHeuristic = 0",
  ).get(sessionId);
  if (alreadyDeep) continue;
  const evaluation = readValidArtifact(root, session);
  if (!evaluation) continue;
  recordDeepEvaluation(db, evaluation);
  recorded += 1;
}
```

### Non-heuristic DB contract

`recordDeepEvaluation()` writes the required non-heuristic contract only after artifact validation:

```ts
INSERT OR REPLACE INTO evaluations (
  sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
  verdict, issues, overall, usage, failureChains,
  evaluatedByHeuristic, skippedByJs, createdAt
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

with values:

```ts
0, // evaluatedByHeuristic
0, // skippedByJs
Date.now(),
```

`parseDeepEvaluationArtifact()` also stamps `overall.deepEval = true` and `overall.deepEvalVersion = 1`, making the lane distinguishable from heuristic aftermath rows.

## Restart/deploy durability assessment

**Assessment: durable.** The lane is not only runtime state:

- The handler exists in tracked source at `agents/may/handlers/eval-llm-scan.ts`.
- The cron job is enabled in tracked source at `agents/may/cron.json`.
- The evaluator LLM work is routed through tracked workflow `agents/shared/workflows/evaluator-deep-eval.ts`.
- The handler emits trace events (`evaluation.deep_dispatched`, `evaluation.deep_recorded`, `evaluation.deep_failed`) so runtime recurrence can be diagnosed.
- `git log -- may/handlers/eval-llm-scan.ts may/cron.json ...` shows multiple tracked commits for this lane, including async-dispatch and failure-classification hardening.

The only caveat found is test-environment specific: `agents/shared/tests/eval-llm-scan.test.ts` imports `../../../src/lib/requests.js`, but this container does not have `/app/src`, so that unit test cannot run here. The static smoke test below covers the durable wiring without needing the missing runtime source tree.

## Recurrence-prevention check

Implemented/identified static smoke check: `agents/test/eval-llm-scan-smoke.test.ts`.

It fails if:

- `may/cron.json` is missing an enabled `eval-llm-scan` entry,
- the cron entry is not wired to handler `eval-llm-scan`,
- the tracked handler file is absent, or
- the handler no longer contains the core validated-write markers (`readValidArtifact`, `recordDeepEvaluation`, `evaluatedByHeuristic/skippedByJs`, and `source: "eval-llm-scan"`).

Verification from both working directories:

```text
cd /app/agents && bun test test/eval-llm-scan-smoke.test.ts
2 pass, 0 fail

cd /app && bun test agents/test/eval-llm-scan-smoke.test.ts
2 pass, 0 fail
```

The full runtime-coupled unit test remains useful where `/app/src` is available, but in this mounted agents-only environment it fails at import time with `Cannot find module '../../../src/lib/requests.js'` before evaluating handler behavior.

## Fresh runtime DB verification

After waiting for the next ingestion/snapshot cycle, runtime state is healthy again:

### Metric rows

```text
eval.llm-coverage-lag-h: current=0.04, threshold=4, target=1, alert_op=>, updated_utc=2026-05-13 04:50:24
eval.llm-evals-24h:       current=14, threshold=1, target=4, alert_op=<, updated_utc=2026-05-13 04:50:24
```

### Direct non-heuristic lag query

```text
live_lag_h=0.055
latest_nonheuristic_utc=2026-05-13 04:48:17
nonheuristic_24h=14
```

### Latest non-heuristic row

```text
sessionId=s_1778587481691_3
agent=arc
verdict=good
evaluatedByHeuristic=0
skippedByJs=0
created_utc=2026-05-13 04:48:17
overall.deepEval=1
overall.deepEvalVersion=1
```

### Trace events

Latest relevant events show the expected two-phase behavior: dispatch first, recording on the next scan after a valid artifact exists.

```text
2026-05-13 04:48:17 evaluation.deep_recorded source=eval-llm-scan count=1
2026-05-13 04:18:17 evaluation.deep_dispatched source=eval-llm-scan sessionId=s_1778587481691_3
2026-05-13 03:48:17 evaluation.deep_dispatched source=eval-llm-scan sessionId=s_1778587481691_3
```

The repeated dispatch was explained by the first deep-eval workflow error followed by a successful retry; after the later child completed and wrote its artifact, the next scan recorded it. This is not evidence of a missing tracked source path.

## Conclusion

The source-of-truth discrepancy is resolved: the lane exists in tracked handler/cron/workflow/test files, survives restart/deploy through `may/cron.json`, and has a recurrence smoke check. Runtime verification confirms the lane recorded a fresh `evaluatedByHeuristic=0` evaluation and the lag metric is back below threshold without reintroducing a blocking 300s handler path.
