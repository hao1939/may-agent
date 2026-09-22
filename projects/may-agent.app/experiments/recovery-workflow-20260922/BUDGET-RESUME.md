# Deferred Evaluation: automatic resume and reviewer failure

Date: 2026-09-22. Follow-up to the [real-model recovery trial](REPORT.md).

**Result:** the existing scheduler resumes a budget-deferred review without
manual intervention. No scheduler or recovery controller change was needed.
A separate Evaluation failure-result mismatch required removing `actions: []`
from its `incomplete` result. The existing SDK contract requires that field to
be omitted. This preserves the original execution failure as an accepted
unfinished report instead of replacing it with a result-validation error.
Existing waits and independent obligations are unaffected.

## What ran

Host `20049916b79d2ba2d2265edf5eeb605ff0e59c05`; Apps baseline
`23394d9543708a38e349ba6bd83a3fedb171efe9`. Trial 4 used unchanged source.
Trial 5 used the one-line Evaluation correction in this commit; the exact
copied source and executed harness remain with each trial.

The harness composes the production Task runtime/controllers, nearest-due
scheduler, SQLite store, EventBus, inbox subscriptions, public socket reads and
Evaluation workflow. It occupies one ordinary allowance in fresh isolated
storage, with an explicitly configured 60-second allowance interval. A fixture
workflow fails once and then succeeds on its ordinary retry. Its real failure
event admits Evaluation, which must wait until the saved allowance boundary.
After the one original admission there are no manual wakes, reconciliation
calls, clock changes or input steering.

The evaluator is a **scripted** manager result, and the report consumer is a
**scripted** fixture App. The evaluator checks that its invocation is after the
deadline and that the public snapshot contains the recovered subject. Production
Evaluation owns report writing, read-back, hashes and event publication. This
proves wiring, not model reasoning, May consideration or live deployment. There
were zero paid model calls. The earlier real-model trial remains separate.

| Trial | Observed review results | Publication | Elapsed |
| --- | --- | --- | --- |
| 4, unchanged source | waiting → converged | One report, event 25, accepted and consumed | 51,889 ms |
| 5, corrected failure result | waiting → incomplete → waiting → converged | One report, event 39, accepted and consumed | 105,660 ms |

In trial 4 the saved deadline was `2026-09-22T09:22:00Z`; the scripted reviewer
started 1,527 ms later and read the already-recovered subject. In trial 5 the
first reviewer invocation deliberately returned an execution error. Evaluation
retained its exact failure facts as `incomplete`, retried normally, waited for
the next allowance and succeeded. Both trials kept the same review identity
and generation 1. Neither emitted duplicate publications or validation failures.
Independent read-back verified both report hashes, event admission, accepted
attempt history and converged subject/review/consumer resources.

## Failed trials and verification

- Trial 1 failed during source copying because the filesystem was full, before
  runtime or model execution. Only downloadable npm cache content was removed
  to make space; task records and trial evidence were retained.
- Trial 2 omitted the fixture agent manifest. Workflow discovery failed, so it
  could not prove subject recovery. The harness was corrected.
- Trial 3 omitted `structuredResult` from the scripted manager result. The
  runtime correctly treated that fixture result as an execution error. It also
  exposed Evaluation's invalid `incomplete` payload. Neither defect is a
  failure of automatic timer wakeup: the reviewer was invoked after the deadline.
- The existing failed-reviewer regression was extended to pass actual workflow
  output through `admitTaskReconcileResult`. It failed before the one-line fix.
  Evaluation `bun run check` then passed syntax, type and formatting checks plus
  192 tests. The first full-check attempt could not find the sibling Host in
  the isolated checkout; linking the existing Host source resolved setup.

## Evidence and reproduction

Local evidence root: `/app/.state/review-pilots/guarded-task-close-20260922/`.
Each `evaluation-budget-trial-N/` retains executed harness, copied source,
SQLite state, events, Tasks, attempts, reviewer input and receipt. Failed trials
remain in place. `evaluation-independent-readback.json` binds the six key
artifact hashes for trials 4 and 5 and records the verified report hashes.

Receipt SHA-256:

- Trial 4: `511630af700f34268036ca6d9c0301afe31d72c0fcf3081848228b510d706a62`.
- Trial 5: `784bd6bf347dc53dbc9c50f2bbc13611f1a26ae174b1a6afe644525475d2de9c`.

Run `bun run-evaluation-budget-resume.ts <fresh-evidence-directory>` using the
retained harness at that evidence root. Set `TRIAL_APPS_ROOT` to a reviewed Apps
checkout to test a candidate; set `TRIAL_REVIEW_FAILURE_ONCE=true` to exercise
trial 5. The retained per-trial harness is authoritative for its exact run.
The test configures only subprocess-local paths/allowances and must not be
pointed at live state. Portable App regression:
`bun test agents/evaluator/workflows/task-outcome-review.test.ts` from
`projects/evaluation.app` with its SDK dependency installed.
