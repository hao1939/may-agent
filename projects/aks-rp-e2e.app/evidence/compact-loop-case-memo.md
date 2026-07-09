# Compact Loop Case Memo

Status: active learning memo

## 2026-07-09 Training Iteration

Reviewed current compact-loop work instead of historical guesses.

### Case: `reconcile-compact-loop-live-workflow`

Outcome: planner accepted the work after reviewer initially asked for redo.

What worked:

- The worker compared current compact facts with previous fingerprints.
- It refused a broad unchanged rerun for `bootstrap-profile`,
  `serverless-schedulerctrl`, and `workload-identity`.
- It kept exact existing waits as the real frontier.

What failed:

- The worker completion was useful as prose/evidence, but not reviewer-ready as
  structured fix-forward output.
- The reviewer correctly did not infer acceptance from prose.

Learning:

- Compact fix-forward tasks must always end with `FIX_FORWARD_RESULT`.
- "No rerun; exact wait remains" is a valid result, but it must be structured.

### Case: `reconcile-compact-loop-package-partial`

Outcome: planner accepted the work after reviewer initially asked for redo.

What worked:

- The worker treated the package-partial family as classified exact frontiers,
  not as a reason to rerun the whole family.
- It recognized that no meaningful package/runtime change justified a broad
  rerun.

What failed:

- Same structural gap: useful family reasoning arrived in prose/evidence, not
  a complete fix-forward result.

Learning:

- For compact family tasks, `subject.kind` should be `feature-family`.
- `subject.id` should name the compact error class or family.
- `verification.status=not-run` is acceptable when rerun would be untruthful,
  but `verification.resultPath` must point to the evidence/checkpoint.

### Case: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090218`

Outcome: accepted and rolled up by owner review.

Why this case matters:

- It is a focused branch diagnosis, not a family reconciliation.
- It should not create a broad compact-planner issue.
- It should either accept existing same-run evidence, create one exact
  single-spec verifier, or record an exact spec/product wait.

What worked:

- The worker named the exact Fleet spec branch.
- It reviewed both the compact artifact and same-path verifier evidence.
- It avoided a broad compact-planner rerun.
- It concluded the existing Fleet version-progression holder is the truthful
  frontier.

What still needs improvement:

- The accepted output was still mostly prose evidence.
- It did not make the routing result self-contained with a structured
  `FIX_FORWARD_RESULT`.

Learning:

- Focused compact branch tasks can complete without a rerun when same-path
  evidence already proves the exact frontier.
- The workflow should still end with structured fields so the reviewer/planner
  do not need to infer the decision from prose.

### Case: `reconcile-compact-loop-live-workflow` 2026-07-09 rerun

Outcome at review time: worker completed quickly and moved to review.

What failed:

- The worker reused the older evidence path
  `evidence/archive/reconcile-compact-loop-live-workflow-task-202607080313-worker.md`
  and reported `done` for the new 2026-07-09 attempt.
- That may be truthful only if the old evidence remains exact, but the result
  did not make that freshness decision structured.

Learning:

- Compact workers must not claim `done` from stale evidence alone.
- If old evidence remains authoritative, the worker must say so directly in
  `FIX_FORWARD_RESULT.diagnosis` and point `verification.resultPath` at that
  exact evidence or holder.
- Otherwise the worker should write a fresh attempt evidence note.

## Workflow Change From This Iteration

The default task-worker prompt now adds compact-specific fix-forward guidance
for compact follow-up and focused diagnostic tasks:

- compare input and error fingerprints before rerun;
- do not broad-rerun unchanged compact families;
- use exact wait/done when existing holders remain truthful;
- include changed evidence/state paths in structured fields;
- require fresh attempt evidence, or explicitly classify reused evidence as
  still authoritative in `FIX_FORWARD_RESULT`;
- always emit complete `FIX_FORWARD_RESULT`.
