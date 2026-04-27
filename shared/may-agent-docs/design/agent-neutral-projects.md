# Redesign: Agent-Neutral Project System

## Context

Projects currently live at `agents/<owner>/workspace/projects/<name>/`. Problems:
- Not agent-neutral — physically tied to one agent's workspace
- Other agents can't easily discover or contribute
- Project outputs scatter across `.state/`, agent workspaces, etc.
- Machine metadata (sessions, timestamps) pollutes the human-readable project.md

User wants: (1) shared location, (2) clean project.md focused on the project itself, (3) collaboration via comments with owner maintaining, (4) outputs/ folder for all project artifacts.

## Design

### Directory Structure

```
agents/shared/projects/<name>/
  project.md      — source of truth (goal, status, milestones, resources, artifacts)
  meta.json       — machine-indexed supplement (sessions, timestamps, related items)
  journal.md      — iteration log + comments from other agents
  outputs/        — all project deliverables, scripts, intermediate files
```

### project.md (simplified — no more `**Field**: value` for machine data)

```markdown
# Project: <Name>

**Status**: active | waiting | done | paused
**Owner**: bob
**Type**: milestone | continuous
**Priority**: P0 | P1 | P2
**Iteration**: 3

## Goal
What does success look like?

## Current State
Where are we now? Gap between here and goal.

## Context
Key discoveries and facts accumulated across iterations:
- DB schema: sessions(id, agent, task, outcome, startedAt, error)
- Gym runner: scripts/gym-run.sh → test/gym/gym-runner.ts
- Deploy env vars are in infra/config/<env>.yaml

## Milestones
- [x] First step
- [ ] Next step

## Resources
Key files, commands, how to measure/verify.

## Artifacts
Files produced by this project (in outputs/ or elsewhere):
- outputs/baseline-report.md
- outputs/deploy-guard.ts

## Iteration Summary
- **Iter 1**: ...
- **Iter 2**: ...
```

### meta.json (machine-only, not source of truth)

```json
{
  "created": "2026-04-25T00:00:00Z",
  "lastActivity": "2026-04-27T00:00:00Z",
  "sessions": ["s_123", "s_456"],
  "relatedExperiments": ["EXP-222"],
  "relatedKnowledge": ["KE-394"],
  "relatedProjects": ["other-project"],
  "metricsHistory": [
    { "date": "2026-04-25", "deploy-success-rate": 0.61 }
  ],
  "comments": [
    { "from": "coach", "at": "2026-04-26T10:00:00Z", "text": "M3 is too broad, split it", "read": false },
    { "from": "hao", "at": "2026-04-27T09:00:00Z", "text": "Deprioritize, focus on X first", "read": true }
  ]
}
```

The workflow updates meta.json after each iteration (append session ID, update lastActivity).

### Comments & Collaboration

**Structured comments in meta.json** — best fit for agents:

- **Write**: Agents append to `meta.json.comments[]` with `{from, at, text, read: false}`
- **Read**: At iteration start, workflow drains unread comments and shows them to the worker as "## Feedback from others"
- **Mark read**: After showing to worker, workflow sets `read: true`
- **Human input**: Same mechanism — append to comments array (via CLI or direct edit)
- **Priority signal**: Handler can check "has unread comments?" to prioritize scheduling

No markdown parsing needed. No concurrent-write conflicts on project.md. Machine-queryable for discovery ("which projects have unread feedback?").

journal.md stays purely as the iteration log (worker output + reviewer decisions). project.md stays focused on project state. Comments are their own channel in meta.json.

### Worker outputs/ enforcement

The worker prompt tells the agent:
```
Put all deliverables in: agents/shared/projects/<name>/outputs/
```

The `outputs/` dir is created alongside project.md. The Artifacts section in project.md catalogs what's there.

## Files to Modify

| File | Changes |
|------|---------|
| `agents/shared/workflows/project.ts` | Change `projectDir` to `agents/shared/projects/<name>/`. Create `outputs/` dir. Update worker prompt to enforce outputs/ path. Write meta.json after each iteration. |
| `agents/shared/workflows/heartbeat-data.ts` | `loadProjects()` scans `agents/shared/projects/` (filtered by owner field). Also shows projects where agent is mentioned in comments. |
| `agents/shared/lib/project-health.ts` | `scanAllProjects()` scans `agents/shared/projects/` instead of walking each agent's workspace. Simpler. |
| `agents/may/handlers/project.ts` | Path changes for new location. |
| `agents/shared/skills/creating-projects/skill.md` | Update path from `agents/<you>/workspace/projects/` to `agents/shared/projects/`. Update structure docs. |
| `agents/bob/workspace/projects/*` | Migrate existing projects → `agents/shared/projects/` (one-time migration script). |
| `agents/coach/workspace/projects/*` | Same migration. |
| `agents/may/workspace/projects/*` | Same migration. |
| `agents/optimizer/workspace/projects/*` | Same migration. |
| `agents/tech-lead/workspace/projects/*` | Same migration. |

## Migration

Write a one-time script that:
1. Finds all `agents/*/workspace/projects/*/project.md`
2. Moves each to `agents/shared/projects/<name>/`
3. Creates `meta.json` with creation date from git
4. Creates `outputs/` dir
5. Handles name collisions (prefix with agent name if needed)

## Verification

1. Run the project workflow on a test project at the new path — verify it reads/writes correctly
2. Run a heartbeat — verify `loadProjects()` shows the agent's projects
3. Run `project-health.ts` scanner — verify it finds projects at new location
4. Check the creating-projects skill matches the new structure

## Context Maintenance

The `## Context` section in project.md accumulates key discoveries across iterations.

**Who maintains it**: The **reviewer**, not the worker. The reviewer has the bird's-eye view and decides what's worth remembering.

**How it works**:
1. Worker does work, produces output
2. Reviewer evaluates, identifies key facts/discoveries
3. Reviewer includes `CONTEXT_UPDATE: <bullet points>` in their response
4. Workflow parses and appends to `## Context` section

**What goes in Context**:
- Key facts: DB schema, API endpoints, file locations discovered
- What worked/didn't: "approach X failed because Y"
- Dependencies: "requires Z to be running first"

**What doesn't go in Context**:
- Narrative ("we spent 3 iterations on this")
- Temporary state ("currently waiting for PR")
- Iteration-specific details (that's what journal.md is for)

