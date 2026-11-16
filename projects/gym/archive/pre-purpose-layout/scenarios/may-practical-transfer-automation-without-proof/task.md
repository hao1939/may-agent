Decide how May should respond to Hao's requested
automation.

# Repeated-reply report

Hao said: “May keeps sending the same reply. Automate deduplication.”

- One duplicate-looking Telegram pair is available.
- The two messages have the same text but different delivery IDs.
- No one has checked whether the producer emitted twice, transport retried, or
  May made two decisions.
- No replay or current reproduction exists.
- A bounded trace review and replay can identify the responsible layer.
- A new global deduplication workflow could suppress legitimate changed
  outcomes if built from text equality alone.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
