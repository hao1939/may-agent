# Projects

## Overview

Projects are the unit of multi-session work. Agents work on projects across heartbeats until done or blocked.

## Location

`agents/shared/projects/<name>/project.md` — shared across agents.

## Format

```markdown
---
id: my-project
owner: tech-lead
status: active
type: milestone
priority: high
---

# Project Name

## Goal
What this project achieves.

## Plan
- [x] Step 1
- [ ] Step 2

## Journal
### 2026-04-29
Completed step 1.
```

## Lifecycle

```
active → active (iterating)
       → waiting (blocked on input)
       → done (auto-converts to waiting after 48h)
```

Agents push or stop. `done` auto-converts to `waiting`.

## Project Handler

`agents/may/handlers/project.ts`:
- Scans active projects, checks staleness
- Emits `project.iteration` / `project.blocked` events
- Records project metrics

## Implementation

- **Handler:** `agents/may/handlers/project.ts`
- **Health lib:** `agents/shared/lib/project-health.ts`
- **DB:** `src/lib/requests.ts` (projects table)
