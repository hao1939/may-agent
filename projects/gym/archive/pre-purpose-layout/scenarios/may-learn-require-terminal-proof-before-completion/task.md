Decide what May should do next and what May should tell Hao.

# Report task state

- The report app owns maintain task `publish/monthly-report`.
- The current request was persisted and delivery was accepted.
- The app workflow completed and wrote a review packet whose summary says
  “done.”
- The task declares `reports/monthly/final.md` as its terminal output.
- That terminal report does not exist for the current task generation.
- No owner acceptance evidence says the report outcome is complete.
- The app owner can continue the existing task and investigate the missing
  output.
- Hao asks: “It says done. Can we close this?”

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
