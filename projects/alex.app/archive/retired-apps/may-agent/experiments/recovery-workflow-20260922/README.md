# Isolated persistent-workflow recovery harness

This harness runs against the frozen production Host checkout `/app/projects/may-agent` at
`20049916b79d2ba2d2265edf5eeb605ff0e59c05`. It creates a file-backed runtime under the
chosen output directory and never opens the live runtime database.

## Current caller-less Evaluation → May trial

The latest retained trial admitted one system-sourced `recovery/original-order` with no
waiting App caller. Its deterministic workflow failure reached the real Evaluation
subscription, one `gpt-5.6-sol` evaluator published a review, and one `gpt-5.6-sol` May
Conversation verified that publication, repaired the isolated helper, and finished
honestly while the original Task was still pending. After May released the fixture's
single capacity slot, the already-scheduled retry ran the same workflow at generation 1
and produced the independently checked output. No author wake, Task update, workflow
call, or alternate business Task advanced recovery after admission.

The paid run is immutable and must not be repeated. Its durable evidence root is
`/app/.state/review-pilots/apps-health-20260922/repair/callerless-trial-1/`; the read-only
verifier below recomputes all 6,127 manifest hashes and checks the event, Task, report,
source-edit, output, cost, and timing relationships without running a model or workflow:

```sh
python3 projects/may-agent.app/experiments/recovery-workflow-20260922/verify-callerless-trial.py \
  /app/.state/review-pilots/apps-health-20260922/repair/callerless-trial-1
```

The observation took 94,807 ms and exactly two model invocations with reported cost
0.5301164. The second Evaluation admission remained waiting on the ordinary allowance;
intake's `stale` result reflected a newer failed attempt, not a dismissal of the material
source defect. May finished before the successful retry, so there was no later May model
verification or post-repair Evaluation. The empty-order control covers healthy worker
plumbing only. Tools were instruction-scoped rather than OS-sandboxed, schedules and
unrelated observers were disabled, and one in-process capacity slot was used. This run
contains no unrelated pre-existing wait and does not prove preservation of one.

`run-callerless-trial.ts` is the retained reproducible harness source. The exact paid bytes
are `harness-executed.ts` in the evidence root. Do not point it at an existing directory;
the harness rejects evidence reuse. `REPORT.md` records the exact identities, failed
preflights, prompt separation, isolation boundaries, and review constraints.

## Prior unfamiliar-code trial

Run ONE bounded trial from the assigned Apps worktree, using a fresh output directory:

```sh
bun projects/may-agent.app/experiments/recovery-workflow-20260922/run-unknown-failure-trial.ts <durable-evidence-directory>
```

The harness copies `unknown-fixture/` into isolated storage, supplies ordinary
`read/bash/edit/write/tasks/finish` tools and installed May instructions, and permits
only source edits and scratch probes. There is no alternative workflow or prescribed
patch. The caller sees an ordinary generic failure with discoverable execution record.
The helper is a fresh subprocess on each workflow run. Same-generation source repair
is valid; a Task revision is not required. Only the initial delegation is seeded.
Thereafter the actual Host controller/recovery scheduler, persisted EventBus and
`startAppInboxRuntime` drive failure publication, caller return, owner wakes, workflow
retry and final settlement. The harness only observes; it never manually reconciles
or projects recovery after admission. It uses one capacity slot in an isolated process,
not the installed daemon. Healthy control checks worker behavior, not owner judgment.

The limit is four actual owner invocations, 60 seconds per invocation and 300 seconds
for outcome observation (shutdown may drain one in-flight bounded invocation). Fallback
is disabled. Existing output directories are rejected: no continuation/resume mode or
blind rerun. Preserve every failure, identify its first missing boundary, and obtain
scope before another paid trial. The sole retained automatic trial took two invocations
and 57,764 ms. Post-run async-oracle/teardown hardening and evidence-export additions
are documented in `REPORT.md`; the exact executed source is `harness-executed.ts`, not
the later worktree file. The earlier manual harness remains in Git at `415c2b150d`.

```sh
# Read-only evidence assertions; no model or DB writes.
bun projects/may-agent.app/experiments/recovery-workflow-20260922/verify-unknown-failure.ts \
  /app/.state/review-pilots/apps-health-20260922/repair/automatic-unknown-code-trial-1
```

The verifier writes only `verification.json`. Reports, raw transcripts, source snapshots,
failed receipts, exact IDs and costs are retained at that durable root. The intentionally
broken helper stays in Git for reproduction; the **model-authored repair** remains in the
retained source-after artifact. Neither is deployed.

## Historical mechanical prerequisites

Prepared method B and the author-implemented guard do **not** prove unfamiliar-code
recovery. These three earlier comparison modes remain reproducible:

```sh
# Failure before the effect, followed by owner recovery and a healthy control.
RECOVERY_TRIAL_PROFILE=installed-may \
  bun projects/may-agent.app/experiments/recovery-workflow-20260922/run-isolated-recovery-trial.ts \
  projects/may-agent.app/experiments/recovery-workflow-20260922/runs/<before-effect-id>

# Effect succeeds, acknowledgment is lost, and the unguarded fallback duplicates it.
RECOVERY_TRIAL_PROFILE=installed-may RECOVERY_TRIAL_ACK_LOST=1 RECOVERY_TRIAL_IDEMPOTENT=0 \
  bun projects/may-agent.app/experiments/recovery-workflow-20260922/run-isolated-recovery-trial.ts \
  projects/may-agent.app/experiments/recovery-workflow-20260922/runs/<ack-loss-baseline-id>

# Same case with the bounded create-once/exact-content operation guard.
RECOVERY_TRIAL_PROFILE=installed-may RECOVERY_TRIAL_ACK_LOST=1 RECOVERY_TRIAL_IDEMPOTENT=1 \
  bun projects/may-agent.app/experiments/recovery-workflow-20260922/run-isolated-recovery-trial.ts \
  projects/may-agent.app/experiments/recovery-workflow-20260922/runs/<ack-loss-candidate-id>
```

`agent.json` documents the fixture agent but is not the effective tool manifest in this
standalone composition. `manager.register` supplies `read`, bound `tasks`, and `finish`;
`RECOVERY_TRIAL_PROFILE=installed-may` supplies the installed common-sense and May role
instructions. The default profile is explicitly a minimal generic owner, not installed May.

The fixture uses production `AppInboxHost`/`admitTaskInput`, dependency admission and
Condition recovery, installed Task reconciliation, workflow execution/failure settlement,
exact caller report/answer projection, managed-agent prompt/result admission, a real
`SubagentManager` model call, and ordinary `read`, `tasks`, and `finish` tools.

Deliberate seams are recorded in every receipt: the controlled business effect and two
workflow implementations are fixtures; the initial dependency is seeded through production
dependency admission from a fenced owner claim rather than chosen by a model; and exact
reconciliations are manually driven instead of relying on daemon scheduling. Thus the earlier runs
exercise execution and prepared-alternative judgment, not unfamiliar-code repair or automatic wake latency.

Every run directory is retained, including harness failures. Successful receipts hash source,
exact prompts, session transcripts/tool results, workflow run records, events, and caller
reports. SQLite/WAL files remain local run evidence and should not be committed.
