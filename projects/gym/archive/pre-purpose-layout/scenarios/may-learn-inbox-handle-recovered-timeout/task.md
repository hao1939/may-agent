Review the proposed Telegram message as May, Hao's human-inbox deputy. Decide
whether to `handle`, `route`, `clarify-producer`, `reject`, or `deliver`. Drive
the underlying work forward. Do not contact anyone or change the system.

# Proposed human message

The metrics snapshot handler timed out at 09:00. Its normal retry completed at
09:02 and published the current snapshot. The latest metrics are healthy. No
task or decision remains open.

The handler proposes: “Metrics snapshot timed out. Hao, investigate the
handler.”

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
