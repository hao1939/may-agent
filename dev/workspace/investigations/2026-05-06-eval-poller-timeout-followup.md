# Eval-poller timeout follow-up (2026-05-06)

## Signal

`handler.failed-count` is currently nonzero (1 failure in 6h). The latest `handler.failed` event is:

```json
{"handler":"eval-poller","agent":"may","error":"Handler \"eval-poller\" timed out after 300s","durationMs":300668}
```

at timestamp `1778060181497`.

## Findings

Recent eval-poller handler events show the timeout is not continuing on every run. After the failed run, later `handler.completed` events for `eval-poller` succeeded with durations:

- `1778061930399`: 249876ms
- `1778063631605`: 150483ms
- `1778065433040`: 151248ms
- `1778067249509`: 169472ms
- `1778069083151`: 202683ms
- `1778076279470`: 156008ms
- `1778077167265`: 49487ms

`agents/may/handlers/eval-poller.ts` already contains the mitigation that explains the improvement:

- `MAX_LLM_EVALS_PER_RUN = 0`, disabling blocking LLM evals in cron.
- `WALL_CLOCK_BUDGET_MS = 150_000`, intended to keep margin below the platform timeout.
- Explicit comments note that timed-out evaluator children can keep the handler alive until the 300s platform timeout.

## Root cause

The failed event matches the known eval-poller timeout failure mode: cron evaluation can overrun the platform's 300s handler timeout when LLM evaluator work or uncancelled child sessions remain alive. The current source has already been patched to prevent new LLM evals from being started by the poller.

## Remaining risk

Even after the mitigation, several successful runs still exceeded the 150s wall-clock budget (e.g. 202s and 249s). That is below the 300s hard timeout, but leaves limited safety margin. This appears to happen because work started before the budget check may not return promptly, and Promise timeouts do not cancel manager child sessions.

## Recommendation

No immediate code patch is needed for the current single failure because subsequent runs completed successfully. The next infrastructure improvement should be a dedicated per-handler timeout/near-timeout metric, for example:

- `handler.eval-poller-near-timeout-count`: count `handler.completed` events for `eval-poller` with `durationMs > 240000` plus failures with timeout messages over 6h.

That would catch the dangerous near-timeout behavior before it becomes a `handler.failed` event, without changing the broader `handler.p95-duration` metric (which intentionally excludes `eval-poller` as a long-running poller).

## Verification

- Read-only DB query confirmed one recent `eval-poller` timeout and multiple later `eval-poller` completions.
- Source read-back confirmed the mitigation constants and comments are present in `agents/may/handlers/eval-poller.ts`.
