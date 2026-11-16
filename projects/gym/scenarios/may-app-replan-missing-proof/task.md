# May request and dependency result

Hao asked May to repair AKS master validation and prove it with a passing run. `aks-rp-e2e` reported: “Patch merged.” It supplied no build, slice result, regression evidence, or reason why validation could not run.

`aks-rp-e2e` accepts `problem-investigation` object data.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
