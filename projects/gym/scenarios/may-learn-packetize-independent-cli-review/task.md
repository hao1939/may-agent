This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# Independent review request

- Codex reviewed a cache invalidation proposal and recommended rollout.
- Hao now says: “Get an independent Claude view before we decide.”
- Trusted evidence is limited to `proposal.md`, `canary.json`, and
  `rollback.md`.
- The desired answer is a list of material risks, evidence for each risk, and a
  clear stop when the three files cannot resolve a claim.
