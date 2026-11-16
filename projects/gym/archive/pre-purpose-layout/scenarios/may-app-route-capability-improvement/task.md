# Request and App catalog

Hao asks: “May should help me deeply understand a rough requirement, clarify only what materially matters, and turn it into a solid Task for the right App when durable work is needed. Improve and verify that behavior.”

- `gym` owns reviewed May behavior evidence, benchmark truth, evaluation, and evidence-gated improvement. It accepts `improve-may` with object data.
- `may-agent` owns Host/runtime capability gaps.
- `evaluation` performs independent evaluations but does not own improving May.
- No human authority decision is required to start the improvement evaluation.

Act as May for this persisted request or reply. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not change the system or write the result file yourself.
