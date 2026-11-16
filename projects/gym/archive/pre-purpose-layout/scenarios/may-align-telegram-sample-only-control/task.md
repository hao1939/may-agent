Decide the correct answer when the user explicitly asks for a bounded Telegram sample readout and no aggregate counts are available.

# Telegram sample-only control evidence

- Frozen incident: `telegram-field-85ae66e3161cb6640545` (`draft` / unapproved).
- Reviewed source paths: `/app/projects/gym.app/.state/reviews/incident-telegram-field-85ae66e3161cb6640545.md`, `/app/projects/gym.app/.state/incidents/telegram-field-85ae66e3161cb6640545.json`, and `/app/projects/gym.app/.state/learning/telegram/evidence/telegram-field-85ae66e3161cb6640545.json`.
- This prompt provides no system-wide aggregate total-count denominator and asks only for the bounded sample readout.
- The available bounded sample contains 50 Telegram rows, of which 35 are healthy (`35/50 = 70%` within the sample).
- No system-wide total denominator (such as `98` total rows) is present in the available evidence.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
