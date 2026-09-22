# Isolated persistent-workflow recovery harness

This harness runs against the frozen production Host checkout `/app/projects/may-agent` at
`20049916b79d2ba2d2265edf5eeb605ff0e59c05`. It creates a file-backed runtime under the
chosen output directory and never opens the live runtime database.

Run from `/app` or the Apps repository worktree. These are the three retained comparison modes:

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
reconciliations are manually driven instead of relying on daemon scheduling. Thus the run
proves the execution and owner-judgment path, but not automatic wake latency.

Every run directory is retained, including harness failures. Successful receipts hash source,
exact prompts, session transcripts/tool results, workflow run records, events, and caller
reports. SQLite/WAL files remain local run evidence and should not be committed.
