---
id: KE-2053
title: "standing-orders.md ORDER-003 References Disabled Legacy Project Handler"
date: 2026-06-20
author: arc
status: active
tags: [coherence, staleness, standing-orders, projects, architecture-drift]
related: [KE-2052, KE-2050, KE-1667]
last_verified: 2026-06-20T12:00Z
---

<ai_context>
summary: "shared/standing-orders.md ORDER-003 line 17 states '**Projects** → project handler dispatches tasks or owner agent sessions' but the legacy project handler (agents/may/handlers/project.ts) was disabled on 2026-06-15. The active model is project apps at projects/<id>.app/ which use their own app.ts handlers. This is the standing-orders counterpart to KE-2052 (which covers common-sense.md). Since standing-orders.md is loaded into every agent session and carries DIRECT ORDERS FROM HAO, the stale reference has authority weight — agents will assume that creating a project.md file triggers automatic handler dispatch, which it no longer does. A proposal is filed at agents/arc/workspace/proposals/2026-06-20-standing-orders-003-project-handler-fix.md."
triggers: [coherence-audit, heartbeat, standing-orders-vs-reality]
falsifiers:
  - F1: "If the legacy project handler is re-enabled, this becomes correct." — Check handler status.
  - F2: "If an agent creates a project.md expecting handler dispatch and gets no response, this staleness has caused real work loss." — Monitor for orphaned project.md files.
</ai_context>

# KE-2053: standing-orders.md ORDER-003 References Disabled Legacy Project Handler

## Observation

`shared/standing-orders.md` ORDER-003 (line 17) states:

> **Projects** → project handler dispatches tasks or owner agent sessions

This describes the legacy project handler (`agents/may/handlers/project.ts`), which was **disabled on 2026-06-15** per `projects/may-agent.app/docs/2a-design/projects.md`.

## Current Reality

All 3 active projects use the `.app` model:
- `evaluation.app` (evaluator, P0)
- `aks-rp-e2e.app` (aks-explorer, P1)  
- `may-agent.app` (may, P0)

The `.app` model uses `app.ts` handlers, task trees, and project-specific event subscriptions — not a central "project handler" that scans `project.md` files.

## Authority Weight

Unlike `common-sense.md` (which teaches "how to think"), `standing-orders.md` carries the banner "DIRECT ORDERS FROM HAO." Agents treat its content as mandatory. ORDER-003 explicitly tells agents: "Workflows are for structured bounded work — these are handled automatically: Projects → project handler dispatches tasks."

An agent reading this will conclude that creating a `project.md` file automatically triggers handler dispatch. It does not.

## Impact

- Agents may believe they need only create `projects/<name>/project.md` to get automated dispatch
- The actual mechanism (project apps with `app.ts`, registered via the projects DB table) is not mentioned
- ORDER-003 correctly describes heartbeats and code changes — only the "Projects" bullet is stale

## Relationship to KE-2052

KE-2052 covers the same staleness in `common-sense.md` (lines 13, 36). Both files teach the disabled model. A proposal for `common-sense.md` was already filed (2026-06-19). This KE covers the `standing-orders.md` counterpart.

## Recommendation

A proposal is filed at `agents/arc/workspace/proposals/2026-06-20-standing-orders-003-project-handler-fix.md`. The fix should update ORDER-003 line 17 from:

```
- **Projects** → project handler dispatches tasks or owner agent sessions
```

To something like:

```
- **Projects** → project apps (`projects/<id>.app/`) dispatch tasks via their own handlers
```
