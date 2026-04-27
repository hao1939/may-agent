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
  journal.md      — iteration log (worker output + reviewer decisions)
  discussion.md   — comments from other agents/humans (append-only)
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
Where are we now, what do we know, what's next.
Accumulates across iterations — reviewer updates with findings, facts, and decisions.
For closed projects: summary of conclusions and recommended actions.

## TODO
- [x] First step
- [ ] Next step

## References
Inputs and outputs. Resources for cold-start context, artifacts produced by the project.

**Resources:**
- agents/gym/README.md — gym documentation
- agents/may/cron.json — handler config

**Artifacts:**
- outputs/skills-audit.md — per-skill audit results
- outputs/deploy-guard.ts — deployment guard
```

### Comments & Collaboration

**discussion.md** — simple, append-only markdown file:

```markdown
# Discussion

### coach — 2026-04-27
M3 is too broad, split it into smaller steps.

### hao — 2026-04-27
Deprioritize, focus on X first.

---read @iter7---

### coach — 2026-04-28
Looks good now. Consider adding a gym scenario for this.
```

**How it works:**
- **Write**: Agents/humans append a markdown section: `### <name> — <date>\n<text>\n`
- **Read**: Workflow shows content after the last `---read @iterN---` marker to the worker
- **Mark read**: After processing, workflow appends `---read @iterN---`
- **No JSON parsing**: Just text append and string search

Simple, git-friendly, human-readable, no concurrent-write conflicts.

journal.md stays purely as the iteration log (worker output + reviewer decisions). project.md stays focused on project state.

### Worker outputs/ enforcement

The worker prompt tells the agent:
```
Put all deliverables in: agents/shared/projects/<name>/outputs/
```

The `outputs/` dir is created alongside project.md. The Artifacts section in project.md catalogs what's there.

## Files to Modify

| File | Changes |
|------|---------|
| `agents/shared/workflows/project.ts` | Change `projectDir` to `agents/shared/projects/<name>/`. Create `outputs/` dir. Update worker prompt to enforce outputs/ path. Auto-catalog outputs/ in Artifacts section after each iteration. |
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
3. Creates `outputs/` dir
4. Handles name collisions (prefix with agent name if needed)

## Verification

1. Run the project workflow on a test project at the new path — verify it reads/writes correctly
2. Run a heartbeat — verify `loadProjects()` shows the agent's projects
3. Run `project-health.ts` scanner — verify it finds projects at new location
4. Check the creating-projects skill matches the new structure

## Current State Maintenance

The reviewer updates `## Current State` after each iteration with findings, facts, and decisions.

**Who maintains it**: The **reviewer/orchestrator**, not the worker.

**What goes in Current State**:
- Where are we now, what's the gap to the goal
- Key facts discovered (DB schema, file locations, dependencies)
- What worked and what didn't
- For closed projects: conclusions and recommended next actions

**What stays in journal.md**:
- Per-iteration details (worker output, reviewer decisions)
- Temporary state and iteration-specific notes

## Implementation Status (2026-04-27)

**Done:**
- [x] `agents/shared/workflows/project.ts` — new template, outputs/, discussion.md, context updates, worker prompt restructured, auto-catalog outputs/
- [x] `agents/shared/workflows/heartbeat-data.ts` — scans shared + legacy locations
- [x] `agents/shared/lib/project-health.ts` — scans shared + legacy locations
- [x] `agents/shared/skills/creating-projects/skill.md` — updated paths and structure
- [x] `agents/shared/workflows/master-worker.ts` — updated usage comment for shared path
- [x] Migration — 52 projects moved to `agents/shared/projects/`
- [x] Removed meta.json (unused — nothing reads it)
- [x] Removed `## Iteration Summary` from project.md (duplicates journal.md)
- [x] Auto-catalog: outputs/ files listed in `## Artifacts` after each worker iteration
- [x] Design doc (this file)

**Backward compatible:** Legacy per-agent locations still scanned by heartbeat and health handler.

