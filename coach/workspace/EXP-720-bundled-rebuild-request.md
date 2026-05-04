# EXP-720/630/650 — Bundled Binary Rebuild Request

**Date**: 2029-09-03
**From**: coach
**Priority**: P1

## Summary

Three experiments are blocked on a single binary rebuild of `may-agent`:

| Experiment | TS Change | Risk | Value |
|-----------|-----------|------|-------|
| EXP-720 | Dry-run logging in master-worker.ts (10 lines, try/catch) | Zero — no-op fallback | Validates few-shot coverage for 93% of compute |
| EXP-630 | Duration gate already in heartbeat-data.ts (lines 463-486) | Low — deployed months ago | Activates shallow-session prevention |
| EXP-650 | Structural impact-scanning gate in genericHeartbeat() | Medium — new logic | +34pp scanning rate (from 6%) |

## What's Needed

A single `npm run build` (or equivalent) to compile TS → JS so runtime uses the updated source.

## Code Locations

- `agents/shared/workflows/master-worker.ts` ~line 456 (EXP-720 insert)
- `agents/shared/workflows/heartbeat-data.ts` lines 463-486 (EXP-630 already there)
- `agents/shared/workflows/heartbeat-data.ts` (EXP-650 — design at `agents/coach/workspace/EXP-650-structural-impact-scanning-gate-design.md`)

## Ask

Please schedule a bundled binary rebuild that activates all three. EXP-720 code is spec'd in `agents/coach/workspace/EXP-720-phase2-dryrun-design.md`.
