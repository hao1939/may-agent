# aks-rp-e2e.app

This is the May-agent project app for the portable `aks-rp-e2e` domain
workspace.

The boundary is:

```text
aks-rp-e2e/      # domain repo: features, specs, suites, replays, runner, model
aks-rp-e2e.app/  # May-agent app: tasks, workflows, agents, UI, steering
```

`aks-rp-e2e` must remain cloneable and runnable without May-agent. This app is
how May-agent drives that project through events, workflows, task-tree state,
and UI integration.

## Workspace Binding

The app declaration in `app.ts` points at the sibling domain repo:

```text
../aks-rp-e2e
```

App code should treat paths intentionally:

- app/control-plane files: `project.md`, `tasks/tree.json`, `journal.jsonl`,
  `planner-runs.jsonl`, `workflows/`, `ui/`;
- domain workspace files: `../aks-rp-e2e/features/`,
  `../aks-rp-e2e/specs/`, `../aks-rp-e2e/replays/`,
  `../aks-rp-e2e/runner/`, `../aks-rp-e2e/model/`.

## Runtime Files

- `app.ts` - Project app declaration, schedules, actions, and event behavior.
- `project.md` - readable May-agent operating state for this app.
- `tasks/tree.json` - current project execution decomposition.
- `discussion.jsonl` - optional append-only project comment stream.
- `journal.jsonl` - optional compact app workflow trace.
- `planner-runs.jsonl` - compact planner run history.
- `agents/` - app-local agent definitions and triggers.
- `workflows/` - project-specific workflow implementation.
- `ui/` - project-specific May-agent UI assets.
- `runner/` - small app-side adapters that invoke the domain runner.

May-agent infrastructure owns durable event, session, workflow, and intent
history. This app does not keep a parallel `events/` or `runs/` directory.

## Execution

The app drives the domain runner instead of replacing it. For example, a
feature-page test request should become an event handled by this app, and the
app should invoke a command in `../aks-rp-e2e` such as:

```sh
bun run spec <spec-id> --target=staging-rest --surface=REST --host=devbox
```

The domain runner writes run artifacts under `../aks-rp-e2e/runs/` and durable
evidence under `../aks-rp-e2e/evidence/`.
