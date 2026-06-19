# Proposal: Update common-sense.md Projects Section for .app Model

**Date:** 2026-06-19  
**Author:** arc  
**Priority:** P2  
**Evidence:** KE-2052  

## Problem

`shared/common-sense.md` (loaded into every agent session) teaches the legacy project model:

- Line 13: "use the `project` workflow with a project file at `projects/<name>/project.md`"
- Line 36: "The core workflow is `project` — for any work that spans multiple sessions"

But the legacy project handler was **disabled on 2026-06-15** (per `projects/may-agent.app/docs/2a-design/projects.md`, updated 2026-06-18). All 3 active projects use the `.app` model. No handler dispatches legacy `project.md` files.

## Proposed Change

Replace the Projects section (lines 12-14) with:

```markdown
### Projects
Work arrives as tasks. Simple tasks just get done. For complex work that spans multiple sessions, use a **project app** at `projects/<id>.app/` with `app.ts`, `project.json`, and a task tree. The project app declares its owner, schedules, handlers, and events. (See `projects/may-agent.app/docs/2a-design/projects.md` and `project-app-v3.md` for the full spec. Projects must live under `/app/projects/`.)
```

Replace the Workflows section line 36 with:

```markdown
Workflows enforce process so you can focus on the work. Project apps (`projects/<id>.app/`) drive multi-session work with task trees, metrics, and owner review.
```

Remove or update line 38 (`## Metrics` section in project.md) since metrics are now declared in `app.ts`.

## Rationale

- The design docs were updated; common-sense.md was not
- Every agent session loads this stale instruction
- An agent following the old instruction creates a `project.md` that nothing dispatches
- KE-2050 already identified similar stale references in agent configs — this is the upstream source

## Risk

Low. The legacy format is documented as "still valid for simple one-off work" in the design doc. The proposal acknowledges this while making `.app` the primary instruction.
