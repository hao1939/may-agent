# Gym App

Autonomous operator for the standalone [`../gym`](../gym) benchmark project.
Gym remains runnable from its CLI without this app. This app supplies schedules,
production-failure intake, owner review, and notifications.

## Autonomous flow

```text
evaluation.reviewed ─> incident intake ─> owner proposal ─> human approval
daily schedule ──────> regression run ──> owner review when needed
```

The app does not approve ground truth, rewrite evidence, merge changes, or
expose infrastructure APIs inside the evaluated May execution. It invokes the
same standalone Gym CLI a developer or CI would use.

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
