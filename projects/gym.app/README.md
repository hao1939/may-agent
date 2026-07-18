# Gym App

Autonomous operator for the standalone [`../gym`](../gym) benchmark project.
Gym remains runnable from its CLI without this app. This app supplies schedules,
production-failure intake, owner review, and notifications.

## Autonomous flow

```text
evaluation.reviewed ─> incident task ─> intake workflow ─> review task
daily schedule ──────> regression task ─> run workflow ───> review task
task workflow failure ──────────────────> Gym owner fallback
```

The app does not approve ground truth, rewrite evidence, merge changes, or
expose infrastructure APIs inside the evaluated May execution. It invokes the
same standalone Gym CLI a developer or CI would use.

Events wake reconciliation. Each incident, regression request, and review
request resolves to stable task intent. The task tree records ownership,
attempts, and outcomes; it does not schedule work. Known tasks bind to the
existing Gym workflows, while an unavailable or blocked workflow falls back to
the Gym owner review workflow.

## Actions

- `run-regression` — run `may-alignment`, optionally with `scenario` and
  `trials` parameters.
- `report-incident` — submit a May failure or human correction for intake.

Generated incident packets, run pointers, and review proposals live under the
ignored `projects/gym.app/.state/` directory. Benchmark definitions and approved
labels remain under `projects/gym/`.

## Development

```bash
cd /app/projects/gym.app
bun run check
```
