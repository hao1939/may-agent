# Isolated persistent-workflow recovery harness

This harness runs against the frozen production Host checkout `/app/projects/may-agent` at
`20049916b79d2ba2d2265edf5eeb605ff0e59c05`. It creates a file-backed runtime under the
chosen output directory and never opens the live runtime database.

## Current unfamiliar-code trial

Run ONE bounded trial from the assigned Apps worktree, using a fresh output directory:

```sh
bun projects/may-agent.app/experiments/recovery-workflow-20260922/run-unknown-failure-trial.ts <durable-evidence-directory>
```

The harness copies `unknown-fixture/` into isolated storage, supplies ordinary
`read/bash/edit/write/tasks/finish` tools and installed May instructions, and permits
only source edits and scratch probes. There is no alternative workflow or prescribed
patch. The caller sees an ordinary generic failure with discoverable execution record.
The helper is a fresh subprocess on each workflow run. Same-generation source repair
is valid; a Task revision is not required. Delegation/reconciliation are manually driven
through production admission/execution/settlement/caller-return code.

The retained single trial required two harness-only corrections, documented in
`REPORT.md`. `--resume-verification` continues its exact isolated store after the
first correction; `--audit-retained` checks completed evidence without calling the
model or rerunning workflows. These are harness continuation modes, not recovery tools
available to the tested owner. Do not use them to overwrite another run.

```sh
# Read-only evidence assertions; no model or DB writes.
bun projects/may-agent.app/experiments/recovery-workflow-20260922/verify-unknown-failure.ts \
  /app/.state/review-pilots/apps-health-20260922/repair/unknown-code-trial-1
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
