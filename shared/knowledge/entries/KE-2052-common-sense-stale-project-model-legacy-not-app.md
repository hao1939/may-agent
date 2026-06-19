---
id: KE-2052
title: "shared/common-sense.md Teaches Disabled Legacy Project Model, Not Active .app Model"
date: 2026-06-19
author: arc
status: active
tags: [coherence, staleness, common-sense, projects, architecture-drift]
related: [KE-2050, KE-1667]
last_verified: 2026-06-19T11:30Z
---

<ai_context>
summary: "shared/common-sense.md lines 13 and 36 teach agents to use the 'project workflow with a project file at projects/<name>/project.md' and call it 'the core workflow.' But the legacy project handler (agents/may/handlers/project.ts) was disabled on 2026-06-15. The actual active model is project-apps (projects/<id>.app/). The design doc projects.md was updated 2026-06-18 to reflect this, but common-sense.md was not updated. Since common-sense.md is loaded into every agent session, this mismatch teaches all agents an obsolete workflow. The practical impact is moderate: new projects would be created in the legacy format which is no longer dispatched. Arc's heartbeat standing plan line 'use the project workflow with a project file' is also inherited from this. A proposal to update common-sense.md is filed separately since the file is human-controlled."
triggers: [coherence-audit, heartbeat, common-sense-vs-design-docs]
falsifiers:
  - F1: "If the legacy project handler is re-enabled, common-sense.md becomes correct again." — Check handler status.
  - F2: "If an agent creates a new project as projects/<name>/project.md and no handler picks it up, the staleness has caused real work loss." — Search for orphaned project.md files created after 2026-06-15.
</ai_context>

# KE-2052: common-sense.md Teaches Disabled Legacy Project Model

## Observation

`shared/common-sense.md` (loaded into every agent session) contains two stale project instructions:

| Line | Content | Reality |
|------|---------|---------|
| 13 | "use the `project` workflow with a project file at `projects/<name>/project.md`" | Legacy handler disabled 2026-06-15; active model is `projects/<id>.app/` |
| 36 | "The core workflow is `project` — for any work that spans multiple sessions" | The `project` workflow is no longer the core — project-apps with `app.ts` are |

## Evidence

**Design doc** (`projects/may-agent.app/docs/2a-design/projects.md`, updated 2026-06-18):
> "The project handler (`agents/may/handlers/project.ts`) is disabled as of 2026-06-15."
> "New projects should use the `.app` model."

**Active projects in DB** (all 3 are `.app` format):
- `evaluation.app` (evaluator, P0)
- `aks-rp-e2e.app` (aks-explorer, P1)
- `may-agent.app` (may, P0)

**No active legacy projects exist.**

## Impact

- Every agent session loads common-sense.md and internalizes "use the project workflow with project.md"
- If an agent follows this instruction for new multi-session work, no handler dispatches it
- Arc's own heartbeat plan inherits this instruction for shared projects
- The `## Metric projects` section (line 38) references adding a `## Metrics` section to a project.md — this pattern is dead in the .app model where metrics are declared in `app.ts`

## Recommendation

`shared/common-sense.md` is human-controlled (banner: "Propose changes with evidence"). A proposal to update the Projects section is filed at `agents/arc/workspace/proposals/common-sense-project-model-update.md`.

The fix should:
1. Update line 13 to reference the `.app` model as primary
2. Update line 36 to describe `agents.fork()` as the dispatch primitive (already taught on line 40)
3. Note that legacy `project.md` is still valid for simple arc-style proposals but is not handler-dispatched
