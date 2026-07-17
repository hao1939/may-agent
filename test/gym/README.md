# May-Agent Gym Compatibility Tests

The standalone Gym project lives at `/app/projects/gym` and owns the CLI,
runner, general harness tests, fixtures, scenarios, and shared scoring code.

This directory contains only May-agent compatibility material:

- `run-gym.sh` forwards to `projects/may-agent/scripts/gym-run.sh`;
- `scenarios/` contains May-specific workflow fixtures still used by
  `scripts/gym-run-workflow.sh`;
- `lib/` remains temporarily for those May-specific fixtures.

Run the standalone project from `/app`:

```bash
bun run gym:list -- --tier smoke
bun run gym -- phantom-fix --agent coder
bun run gym:check
```

Use `scripts/gym-run.sh` only when May database recording is required.
