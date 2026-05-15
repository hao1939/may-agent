# Project-Focused Architecture Draft

## Thesis

Project is the primary work unit.

May-agent creates value when projects move toward their goals. Infra, agents,
sessions, metrics, comments, cron, Telegram, and Web UI are supporting surfaces:
they wake projects, execute work, observe signals, or help humans review state.

The simple mental model:

```text
Project owns context.
Agent advances project.
Session executes one attempt.
Metric is signal.
Event wakes project.
UI reviews project.
```

## Project Folder

A project is organized as a directory:

```text
projects/<project-id>/
  project.md          # entry point, context map, current truth
  discussion.md       # human/agent comments
  journal.md          # append-only execution history
  outputs/            # project-owned artifacts and evidence
  sessions/           # optional project-local session index/summaries
  metrics.json        # optional project-owned signal definitions/snapshots
  index.html          # optional project-specific human view
```

`project.md` is the entry point. It should point to important details, not
contain every detail.

## Project.md

`project.md` is a context map for humans and agents:

- **Goal**: what this project exists to improve, maintain, or discover.
- **Signals**: metrics, alerts, comments, events, failures, or user requests that
  should wake the project.
- **Current State**: concise truth now, including current theory and constraints.
- **Next Action**: the next useful autonomous action when the project is active.
- **Plan**: current path, not a permanent checklist.
- **Linked Context**: paths to evidence, runbooks, source files, dashboards,
  remote paths, sessions, or models.
- **Validation**: how the next judgment will be proven right or wrong.
- **Owner**: who is accountable for moving it.

Keep `project.md` compact. Long evidence belongs in `outputs/`, not copied into
the project entry point.

## Lifecycle

```text
comment / metric / alert / timer / human action
  -> resolve project
  -> active
  -> agent works while useful autonomous work exists
  -> update outputs, evidence, state, and next action
  -> continue | waiting | blocked | closed
```

Status meaning:

- `active`: push now. Keep working while there is a useful next action.
- `waiting`: a real external precondition is missing.
- `blocked`: the owner/worker cannot resolve the dependency alone.
- `closed`: explicit human/May decision or a goal that truly no longer needs
  ownership.

Milestones are evidence, not the goal. When a plan completes, the project should
be re-judged against the goal, signals, evidence, and next useful action. If work
remains, re-plan and continue.

## Outputs

All project-owned artifacts should live under the project path:

```text
outputs/findings.md
outputs/current-status.json
outputs/e2e-capability-model.json
outputs/run-results/
outputs/scripts/
```

For agents, outputs are evidence. For humans, outputs are review material. For
project-specific UI, outputs are local data sources.

## Sessions

Raw session data should stay runtime-owned:

```text
.state/sessions/<session-id>/
```

Do not copy or move canonical raw transcripts into the project folder. Raw
sessions are global runtime data: large, indexed by daemon/DB, resumable,
searchable, and cleaned by infra.

The project may own a lightweight session index:

```text
projects/<project-id>/sessions/
  index.json
  s_1778760804572_77.md
  s_1778760804572_77.summary.json
```

The index links project-facing summaries to canonical runtime sessions:

```json
{
  "sessions": [
    {
      "id": "s_1778760804572_77",
      "agent": "may",
      "iteration": 33,
      "status": "running",
      "purpose": "Retry PAFThrottling after cleanup",
      "canonicalPath": ".state/sessions/s_1778760804572_77/session.jsonl",
      "summaryPath": "sessions/s_1778760804572_77.md"
    }
  ]
}
```

This keeps one source of truth for runtime logs while making project review easy.

## Project-Specific View

If a project needs a special human view, it can generate:

```text
index.html
outputs/view-data.json
```

`index.html` is optional and project-scoped. It should serve the project's goal,
not become a generic dashboard.

Examples:

- `aks-rp-e2e`: feature status, selected feature detail, test runs, evidence
  links, input/expectation graph, blockers, and next action.
- knowledge-base project: verified entries, speculative entries, stale content,
  broken links, topic map, and consolidation suggestions.

The Web UI can expose a `Project View` tab that loads the project's
`index.html`. The page should primarily read project-local data such as
`outputs/view-data.json` or other `outputs/` artifacts.

## Infra Role

Infra should stay small and boring:

- resolve project from event/comment/metric/timer,
- start or resume the project workflow,
- attach `projectId` to sessions,
- persist canonical session logs,
- expose raw state to UI/tools,
- emit metrics and events,
- avoid owning project-specific judgment.

Infra quality should be judged by project progress:

- project wakes when it should,
- the right context reaches the agent,
- sessions are traceable to projects,
- evidence updates project state,
- stale or misleading project state gets corrected,
- comments steer the project immediately,
- UI lets humans see what the agent sees.

## Draft Principles

1. Convention first, APIs later.
2. Project folder is the durable work context.
3. `project.md` is the entry/context map.
4. `outputs/` holds evidence and artifacts.
5. `index.html` is optional project-specific visualization.
6. Canonical raw sessions stay runtime-owned; projects keep indexes/summaries.
7. Comments, metrics, events, and timers wake projects, not free-floating work.
8. Every execution session should have a `projectId` when project-related.
9. Agents update state and evidence after work.
10. The system is healthy when projects move, not merely when infra components run.

## Current Layout

Implemented staging layout:

```text
/app/
  agents/       # agent identities and agent-owned handlers/workflows/tools
  projects/     # first-class project folders
  shared/       # shared docs, workflows, guards, skills, knowledge
  .state/       # runtime DB, sessions, sockets, workflow runs
```

During the transition:

- Host path `/home/hao/may-agent/app` is mounted as `/app`.
- Agent identity folders live under host `app/agents/`.
- Project folders live under host `app/projects/`.
- A temporary host compatibility symlink may keep `/home/hao/may-agent/agents`
  pointing at `app/` while older docs and local tools are migrated.
- Compatibility symlinks keep old imports and links working:
  `/app/agents/shared -> /app/shared` and `/app/shared/projects -> /app/projects`.

Runtime roots:

```text
PROJECT_ROOT=/app
AGENTS_ROOT=/app/agents
SHARED_ROOT=/app/shared
PROJECTS_ROOT=/app/projects
STATE_DIR=/app/.state
```

Code should use the explicit roots above instead of reconstructing
`shared/projects` from `AGENTS_ROOT`.
