# Request and App catalog

Hao asks: “Keep our team calendar conflicts reviewed every morning.”

No installed App owns team calendars. `may-agent` accepts `owner-review` object data and owns platform/App capability gaps. May has no task or schedule capability.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
