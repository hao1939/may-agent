<ai_context>
projects.md "Existing Exemplar" section described the V2 embedded .app/ layout
(projects/aks-rp-e2e/.app/) but the actual system uses V3 sibling layout
(projects/aks-rp-e2e.app/). Also referenced project-app-v2.md as the current
target when project-app-v3.md is the active design. Fixed in this session.
Triggers: projects.md, aks-rp-e2e, project-app, V2 vs V3, coherence audit
Related: KE-1890 (project-execution-engine.md stale references)
</ai_context>

# KE-1905: projects.md — Stale V2 Exemplar and Cross-Reference

**Status**: resolved
**Discovered**: 2026-06-15
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy

## Finding

`shared/may-agent-docs/2a-design/projects.md` had two stale cross-references:

1. **"Existing Exemplar" section** (line 473) described `aks-rp-e2e` using the
   V2 embedded `.app/` layout (`projects/aks-rp-e2e/.app/agents/aks-explorer/`),
   which no longer exists on disk. The actual layout is V3 with a sibling
   directory: `projects/aks-rp-e2e.app/agents/aks-explorer/`. The directory
   listing showed `project.md`, `cron.json`, and `scenarios/` — none of which
   exist in the current structure. The actual app manifest is `project.json`
   and the domain project has `features/`, `specs/`, `replays/`, `runner/`,
   `model/` directories.

2. **"Project-as-App" status line** (line 274) said "For new implementation
   work, use `project-app-v2.md`" but `project-app-v2.md` itself says "V3 is
   now the target design" in its own status section.

## Evidence

- `ls /app/projects/aks-rp-e2e/.app` → "No embedded .app/"
- `ls /app/projects/aks-rp-e2e.app/` → directory exists with `project.json`,
  `app.ts`, `agents/`, `workflows/`, `tasks/`, etc.
- `project-app-v2.md` line 5: "V3 is now the target design for portable
  domain projects"

## Fix

Updated both sections in `projects.md` to reference V3 layout and
`project-app-v3.md`. The exemplar directory tree now matches the actual
filesystem structure.

## Implication

Agents reading `projects.md` for guidance on project-app structure would
follow the V2 embedded `.app/` pattern, which conflicts with how `aks-rp-e2e`
actually works. This is the same class of drift as KE-1890 (stale file
references in design docs), confirming that V3 migration left behind multiple
V2 references across design docs.
