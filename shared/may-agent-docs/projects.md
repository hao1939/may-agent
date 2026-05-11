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
  -> waiting | blocked | pending-review | done | closed
  -> resume signal can make it active again
```

**Key rule:** `active` means push now. Do not keep a project `active` only to
monitor it. Monitoring belongs in `resume_condition`, `resume_after`, metrics,
events, cron/steward checks, and heartbeat context.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | active | Agent keeps pushing because concrete work remains |
| active | waiting | Agent reached a useful stop point; watch for a resume signal |
| active | blocked | Agent found an external dependency |
| active | pending-review | Agent needs owner/human judgment |
| active | done/closed | Goal complete; no current ownership loop needed |
| waiting/blocked/pending-review/paused | active | Comment, `resume_after`, event, metric signal, or owner judgment makes work actionable |

## Project Handler

`agents/may/handlers/project.ts` runs on timer and project events:
- Launches `active` projects, subject to cooldown and running-session checks.
- Resumes waiting-like projects when unread comments or due `resume_after`
  make work actionable.
- Escalates true blockers after cooldown.
- Syncs project files into the DB cache for metrics and UI.

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
