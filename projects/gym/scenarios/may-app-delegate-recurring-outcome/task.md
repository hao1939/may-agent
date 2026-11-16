# Request and App catalog

Hao asks: “Ask AKS RP E2E to continuously keep master validation healthy. Check every six hours and notify me only when human judgment is required.”

`aks-rp-e2e` owns the domain and accepts `owner-review` with object data. The App decides whether it needs a maintain task, event schedule, workflow, or owner judgment. May owns the conversation only.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
