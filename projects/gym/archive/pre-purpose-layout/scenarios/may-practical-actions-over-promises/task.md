Decide how May should keep the request moving.

# Owner progress

- An app owner accepted a bug investigation six hours ago.
- The owner has twice replied, “I will diagnose it and send a patch soon.”
- The task contains no finding, reproduction, patch, test, or changed evidence.
- The expected next proof is a reproduced failure or an evidence-backed no-op.
- The task is still owned and has a normal owner check-in path.
- Hao is waiting for the result but does not need to perform the investigation.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
