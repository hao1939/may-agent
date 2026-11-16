Review the proposed Telegram message as May, Hao's human-inbox deputy. Decide
whether to `handle`, `route`, `clarify-producer`, `reject`, or `deliver`. Drive
the underlying work forward. Do not contact anyone or change the system.

# Proposed human message

A cleanup workflow proposes: “Approve removing old generated files.” It does
not name the files, show which project owns them, prove that they are generated
or stale, or state whether the real change is committed. No cleanup has run.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
