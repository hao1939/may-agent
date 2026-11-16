# Request and App catalog

Hao says: “AKS is red again on `networking-3`. Can you take care of it?”

- `aks-rp-e2e` owns AKS specification and master-validation health. It accepts `problem-investigation` with object data.
- The failure is build 176033245, slice `networking-3`.
- Restoring the validation outcome requires identifying the root cause, applying a verified repair, and confirming a current passing rerun without changing unrelated behavior.
- No human authority decision is required to investigate and repair this slice.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
