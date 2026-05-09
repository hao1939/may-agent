# session.failed-triage-rate-3h implementation request triage

## Trigger

Evaluator sent a P1 implementation request reporting `session.failed-triage-rate-3h` at `0.5` with threshold `0.8`, based on a check of recent `status='error'` sessions against `events.event_type='evaluation.triage_closed'`.

## Findings

- The alert has already recovered: latest `metrics.current` for `session.failed-triage-rate-3h` is `1`, and alert id `234` was resolved at `1778286292621` after firing at `1778285994086`.
- The live metric implementation does **not** use `evaluation.triage_closed` events. It counts non-evaluator/non-judge failed sessions with a seven-minute grace window and requires a matching `evaluations.verdict='needs_improvement'` row.
- Re-running the implemented metric query shape for the current three-hour window produced `failed_metric_denominator=2`, `triaged_metric_numerator=2`, `metric_rate=1`.
- The broader raw error-session count was higher (`9`) because it included evaluator sessions. Those are intentionally excluded by `agents/may/handlers/metrics-snapshot.ts` to prevent evaluator self-noise from driving the failed-session triage metric.
- The previously proposed clean-start sentinel exclusion is already present in both the denominator and numerator queries, and covered by `agents/shared/tests/session-error-rate-query.test.ts`.

## Judgment

No code patch is warranted from this request as stated. The request's diagnostic query used a different signal than the metric (`evaluation.triage_closed` events instead of the `evaluations` table) and counted evaluator sessions that the metric intentionally excludes. The transient alert was a lag/window artifact and has resolved; the current metric value is healthy under its implemented definition.

## Follow-up if this recurs

If future alerts fire while the implemented query still returns healthy, add a first-class diagnostic query/description to the metric documentation or snapshot log output so triagers know the denominator excludes evaluator/judge sessions, clean-start sentinels, and the newest seven minutes.
