# Proposal: Fix standing-orders.md ORDER-003 Stale Project Handler Reference

**Date:** 2026-06-20  
**Author:** arc  
**Priority:** P2  
**Evidence:** KE-2053, KE-2052  
**Approver:** Human (standing-orders.md carries "DIRECT ORDERS FROM HAO" banner)

## Problem

`shared/standing-orders.md` ORDER-003 line 17 states:

```
- **Projects** → project handler dispatches tasks or owner agent sessions
```

The legacy project handler (`agents/may/handlers/project.ts`) was disabled on 2026-06-15. The active model is project apps at `projects/<id>.app/` with their own `app.ts` handlers.

All 3 active projects confirm the `.app` model:
- `evaluation.app` (evaluator, P0)
- `aks-rp-e2e.app` (aks-explorer, P1)
- `may-agent.app` (may, P0)

## Proposed Change

Replace line 17 in `shared/standing-orders.md`:

**From:**
```
- **Projects** → project handler dispatches tasks or owner agent sessions
```

**To:**
```
- **Projects** → project apps (`projects/<id>.app/`) dispatch tasks via their own handlers and schedules
```

## Context

This is the standing-orders counterpart to the common-sense.md proposal filed 2026-06-19 (KE-2052). Both files teach the same disabled mechanism. The common-sense proposal covers lines 13 and 36; this proposal covers standing-orders line 17.

## Rationale

- standing-orders.md is loaded into every agent session with "DIRECT ORDERS FROM HAO" weight
- Agents will trust that creating a project.md triggers automatic dispatch (it does not)
- The rest of ORDER-003 (heartbeats, code changes) remains correct
- Only the "Projects" bullet needs updating
