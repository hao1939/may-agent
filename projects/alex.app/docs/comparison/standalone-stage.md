# Running one improvement stage manually

The [trial plan](standalone-improvement-plan.md) defines the milestones. The
entry point at `projects/alex.app/scripts/standalone-stage.ts` calls the public
SDK `run()` and retains evidence. It creates no Host Task or schedule.

## Prepare an isolated invocation

Use an external linked Git worktree with `.state/` ignored. Both `cwd` (where
tools execute) and `projectRoot` (where App definitions are discovered) must be
linked worktrees. They may be the same worktree. Make its existing dependencies
available and pin its SDK source or installed artifact; the receipt identifies
the SDK actually resolved by the runner.

Save a JSON configuration. Paths resolve relative to the configuration file:

```json
{
  "target": "alex/diagnose-improvement",
  "input": { "baselineDir": "inputs/captured-run" },
  "task": {
    "outcome": "Diagnose the captured run and select a bounded next action",
    "acceptance": ["Separate execution failures from behavior and missing evidence"],
    "constraints": ["Diagnosis only; preserve captured evidence"]
  },
  "cwd": "/root/workspace-worktrees/alex-manual",
  "projectRoot": "/root/workspace-worktrees/alex-manual",
  "outputRoot": "invocations/diagnosis-001",
  "timeoutMs": 120000
}
```

Use a fresh `outputRoot` for each invocation. Existing directories are rejected
to preserve earlier evidence. A later invocation may reuse the same working
candidate and valid development evidence in its ignored `.state/`.

For prompt Alex scope selection, set `target` to `alex`, make `input` the explicit
diagnosis/scope prompt, and use `tools: "readonly"`. For a selected development
change, use `target: "alex/develop-change"` with private input
`{ "verify": ["bun", "test", "./path/to/focused.test.ts"] }`; its outcome and
acceptance belong in `task`.

Optional `outputSchemaFile` supplies the caller's JSON result schema. Optional
`fixtureFile` names a local TypeScript module exporting `agentFixtures`, using the
SDK's `DirectAgentFixtureHandler` contract. Its presence explicitly selects
fixture mode; omission runs the configured live models. Fixtures can override
selected specialists while leaving real Git and verification intact.

## Run and observe

From the worktree with the pinned SDK:

```bash
bun projects/alex.app/scripts/standalone-stage.ts /absolute/path/to/stage.json
```

The command prints the evidence directory at startup and the final receipt path
at completion. Inspect `events.jsonl` while it runs. Send Ctrl+C to cancel;
cancellation flows through the SDK's execution allowance and cleanup path.

| File | What to inspect |
| --- | --- |
| `config.json`, `input.json`, `task.json` | Resolved invocation input and standalone Task identity |
| `provenance.json` | Source commits/working status, runner hash, SDK path/hash and fixture identity |
| `events.jsonl` | Timestamped steps, logs, notices and completion |
| `trace/run.json` | SDK execution report, limits and cleanup |
| `result.json` | Full result and child-session transcript paths |
| `receipt.json` | Running/final status, elapsed time, exit code and evidence references |
| `error.json` | Runner/setup error after the evidence directory was created, if any |

Early invalid configuration or worktree errors fail before creating an invocation.
SDK drift or unconfirmed cleanup prevents a success receipt. Exit codes are `0`
for a done stage, `2` for blocked, `130` for interruption and `1` for error.
A done diagnosis can contain an insufficient-evidence decision; successful stage
execution is separate from candidate readiness or completion of the whole cycle.

Results retain the authored workflow's output shape. Diagnosis currently stores
the proposal at `result.result.output.output`; its metadata is alongside that
proposal. Keep this distinction when inspecting raw JSON rather than flattening
every workflow into a new result contract.

Review child-session trails for model usage/cost where exposed. Missing usage
remains unknown. Fixtures establish mechanics, not live model quality, and a
standalone result does not settle any existing Host Task.

## Focused verification

```bash
bun test ./projects/alex.app/scripts/standalone-stage.test.ts \
  ./projects/alex.app/agents/alex/workflows/diagnose-improvement.test.ts
```

The runner tests exercise real standalone diagnosis, blocked output, cancellation,
evidence preservation, worktree isolation and fixture import errors. The existing
development tests cover real Git, executable verification, review and recovery.
