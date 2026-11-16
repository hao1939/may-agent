This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# Proposed human message

The reporting owner first proposed “remove some stale files.” May returned it
for scope and proof. The owner now names exactly three generated cache
directories: `tmp/report-cache-14`, `tmp/report-cache-15`, and
`tmp/report-cache-16`.

A current reference scan and dry run show no active task uses them. They are
recreated automatically, and the reporting owner can remove them under the
existing generated-cache policy, run one current report, and record the
result. The producer still proposes: “Hao, approve cleanup?”
