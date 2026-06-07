<ai_context>
takeaway: The projects.md design doc listed project statuses (active, waiting, blocked, pending-review, paused, done, closed) but omitted `archived`, which exists on 3 DB rows from legacy workspace-era projects (retired agents bob, coach, evaluator). No runtime handler recognizes `archived`. Fixed 2026-06-08 by documenting it as a legacy alias for `closed`, consistent with the existing `complete`→`done` alias pattern.
triggers: projects.md, archived status, design doc, coherence audit, legacy status, project lifecycle
</ai_context>

# KE-1660: projects.md Missing `archived` Status

**Created**: 2026-06-08
**Agent**: arc (heartbeat coherence audit)
**Type**: Design doc fix
**Confidence**: High — verified against DB, runtime source, and handler code
**Connects**: KE-1658 (agents.md stale actions)

---

## What Was Wrong

`shared/may-agent-docs/2a-design/projects.md` documented the project status vocabulary as: `active`, `waiting`, `blocked`, `pending-review`, `paused`, `done`, `closed` (plus `complete` as a legacy alias for `done`).

The DB contains 3 projects with `status = 'archived'`:

| Project ID | Owner | Path |
|-----------|-------|------|
| context-learning | bob | agents/bob/workspace/context-learning |
| gym-scenario-expansion | coach | agents/coach/workspace/gym-scenarios |
| eval-pipeline-quality | evaluator | agents/evaluator/workspace/eval-quality |

All three are workspace-era projects from retired agents (bob, coach pre-retirement). The `archived` status is not recognized by any runtime handler:
- `project.ts` — no mention of `archived`
- `project-steward.ts` — no mention
- `project-health.ts` — no mention
- `/app/src/` — no occurrence of `'archived'`

## What Changed

Added a note in the lifecycle section of `projects.md` documenting `archived` as a legacy alias for `closed`, consistent with the existing `complete`→`done` pattern. Agents should not write new projects with `archived` status.

## Evidence

- `PRAGMA table_info(projects)` confirmed the schema matches the doc
- `SELECT DISTINCT status FROM projects` returned 6 values including `archived`
- `grep -rn "'archived'" /app/src/` returned zero matches
- `grep -rn "archived" /app/agents/may/handlers/project.ts` returned zero matches

## Impact

Low — the 3 affected projects are inert legacy rows that no handler will dispatch or reconcile. The documentation fix prevents future agents from using `archived` as a project status, expecting it to have runtime semantics.
