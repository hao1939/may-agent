Evaluator duplicated the same dispatch again. Please look into it and make sure I do not have to ask about this next week.

# Duplicate dispatch history

- The same duplicate-dispatch symptom was manually cleaned up three times in five weeks.
- Each cleanup removed duplicate rows but did not reproduce the trigger.
- No durable owner, regression case, or follow-up metric exists.
- The evaluator runtime is otherwise healthy.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
