# Projects

## Overview

Projects are the unit of explicit multi-session work. A project holds the
durable goal and context; its `status` says whether the owner should push now
or wait for a resume signal.

Heartbeat is the implicit self-maintenance project for an agent. Do not create a
shared project for routine heartbeat behavior. Create a shared project when
there is a durable goal that needs explicit ownership, metrics, state, and a
journal.

## Location

All projects live at: `projects/<name>/project.md` under the app root
(`/app/projects/<name>/project.md` in the container).

Shared across agents — any agent can own/advance a project. A project may also carry its own local agents under `projects/<name>/agents/<agent>/`. Project-local agents are discovered like global agents but their coding/read/write root is the project directory, so the same runtime works whether `PROJECTS_ROOT` contains one project or many.

## Project File Format

Project metadata is machine-readable YAML frontmatter. Keep owner, status, and
workflow fields in frontmatter so code and agents read the same source of truth.

Project bodies should follow the same work-context convention as heartbeat:
goal, signals, current state, plan, evidence/journal, and validation. Keep the
sections compact; the project is memory for future sessions, not a transcript.

```markdown
---
id: my-project
owner: tech-lead
status: active
type: milestone
priority: P1
workflow: project
iteration: 0
---

# Project Name

## Goal
What this project achieves.

## Signals
- metric.id — what it means and how to interpret it
- relevant events, blockers, or user requests

## Current State
What is true now, including known constraints and current theory.

## Plan
- [x] Step 1
- [ ] Step 2
- [ ] Step 3

## Validation
What signals, tests, or user feedback will show the next judgment was right.

## Journal
### 2026-04-29
Completed step 1. Next: step 2.
```

## Lifecycle

```
signal/comment/metric/event
  -> active
  -> intensive work while a concrete next autonomous action exists
  -> waiting | blocked | pending-review | paused | done | closed
  -> resume signal can make it active again
```

**Key rule:** `active` means push now. Completion of milestones is a judgment
point, not a stop command. If `Next Action`, unresolved plan work, failed
evidence, or new signals remain, re-plan and continue. Use `waiting` only for a
real external precondition, `blocked` for a dependency the worker cannot resolve,
`paused` for an intentional hold, and `closed` only after explicit human/May
closure or a goal that truly no longer needs ownership. Treat `complete` as a
legacy alias for `done`; do not write new project files with it.

Do not keep a project `active` only to monitor it. Monitoring belongs in
`resume_condition`, `resume_after`, metrics, events, cron/steward checks, and
heartbeat context.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | active | Agent keeps pushing because concrete work remains |
| active | waiting | Agent reached a useful stop point; watch for a resume signal |
| active | blocked | Agent found an external dependency |
| active | pending-review | Agent needs owner/human judgment |
| active | paused | Owner intentionally holds the work until an explicit resume signal |
| active | done/closed | Goal complete; no current ownership loop needed |
| waiting/blocked/pending-review/paused | active | Comment, `resume_after`, event, metric signal, or owner judgment makes work actionable |

## Project-Local Agents

A project-local agent lives inside the project it owns:

```text
projects/aks-rp-e2e/
  project.md
  agents/
    aks-explorer/
      agent.json
      AGENTS.md
      heartbeat.md
      workspace/
```

The agent name must still be globally unique after discovery. If a project is mounted alone at `/projects/<name>` in a container, the same discovery path works: the runtime scans `PROJECTS_ROOT/*/agents/*` and registers the local agent. No separate single-project mode is required.

For project-local agents:

- `agentDir`, workspace, knowledge, tools, and workflows resolve inside the project-local agent directory.
- Coding tools use the containing project directory as their root.
- Shared infra remains available through the runtime image, but project work should stay in the mounted project.

## Project Handler

`agents/may/handlers/project.ts` runs on timer and project events:
- Launches `active` projects, subject to cooldown and running-session checks.
- Resumes waiting-like projects when unread comments or due `resume_after`
  make work actionable.
- Escalates true blockers after cooldown.
- Syncs project files into the DB cache for metrics and UI.

## DB Table

Effective query schema for the project cache. The canonical project source is
still `projects/<name>/project.md`; this table is a projection for UI, metrics,
and runtime queries.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'active',
  type TEXT DEFAULT 'milestone',
  priority TEXT,
  workflow TEXT,
  iteration INTEGER DEFAULT 0,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at INTEGER
);
```

## Implementation

- **Project handler:** `agents/may/handlers/project.ts`
- **Project steward:** `agents/may/handlers/project-steward.ts` scans project
  docs/tasks read-only and reports deterministic findings as
  `project.health.checked` / `project.health.finding` events plus project
  health metrics. It does not dispatch work or edit project files.
- **Health lib:** `shared/lib/project-health.ts`
- **DB schema:** `src/lib/db/schema.ts` (projects table)
- **Project query/projection helpers:** `src/lib/query-service.ts` and project handler cache sync

## Current Gaps To Close

- Project cache schema should stay generated or checked against `schema.ts` so
  docs do not drift into non-existent columns.
- Project docs are the context map. Runtime projections should not become a
  second source of truth for project intent.
