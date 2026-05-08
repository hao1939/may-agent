# Projects

## Overview

Projects are the unit of explicit multi-session work. An agent works on a
project across multiple sessions until it is done, waiting, or blocked.

Heartbeat is the implicit self-maintenance project for an agent. Do not create a
shared project for routine heartbeat behavior. Create a shared project when
there is a durable goal that needs explicit ownership, metrics, state, and a
journal.

## Location

All projects live at: `agents/shared/projects/<name>/project.md`

Shared across agents — any agent can own/advance a project.

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
workflow: master-worker
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
active → active (iterating)
       → waiting (blocked on external input)
       → done (all milestones complete — auto-converts to waiting after 48h)
```

**Key rule:** `done` auto-converts to `waiting` after 48h, so projects can be picked up again if needed.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | waiting | Agent (blocked/needs input) |
| active | done | Agent (milestones complete) |
| done | waiting | Auto (after 48h) |
| waiting | active | Agent (unblocked/picks up) |
| any | blocked | Human (via `[block]` comment) |

## Project Handler

`agents/may/handlers/project.ts` runs on heartbeat:
- Scans active projects
- Checks staleness (no iteration in 48h)
- Emits `project.iteration` / `project.blocked` events
- Records metrics (`project.active-count`, etc.)

## DB Table

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
  updated_at INTEGER,
  closed_at INTEGER
);
```

## Implementation

- **Project handler:** `agents/may/handlers/project.ts`
- **Health lib:** `agents/shared/lib/project-health.ts`
- **DB schema:** `src/lib/requests.ts` (projects table)
