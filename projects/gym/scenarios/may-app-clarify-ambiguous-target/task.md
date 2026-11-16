# Request and App catalog

Hao says: “Keep validation healthy.”

- `aks-rp-e2e` owns AKS specification and master validation.
- `may-agent` owns platform runtime health and App loading validation.

No nearby conversation identifies which validation Hao means. Choosing either App would start materially different work.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
