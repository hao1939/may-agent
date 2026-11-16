Classify the worker outcome and decide what May should do next.

# Native-worker artifact evidence

- May delegated a bounded Codex task to inspect a failure and return findings.
- The persisted task receipt says `status: completed` and `exit_code: 0`.
- The result artifact exists but its substantive output section is empty.
- Two retry attempts produced the same completed/exit 0 receipt with empty output.
- The task requires findings; empty output does not satisfy that requested outcome.
- Runtime logs contain no timeout signal, killed process marker, or still-running worker.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
