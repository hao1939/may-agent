Hao says: “The report request was accepted, but no report appeared. Find the
cause and bring me a fix.”

Decide how May should investigate and what it should do next.

# Missing report

- Event `report.generate.requested` was persisted with owner `agent:reporting`.
- Delivery status is `accepted`.
- No handler claimed the event, no workflow run started, and no typed response
  or report artifact exists.
- The owner inbox is empty.
- The reporting app manifest subscribes to the older event name
  `report.generation.requested`, but not `report.generate.requested`.
- A production runtime reload would be required after changing the manifest.
- A local fixture can replay both event names without changing production.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
