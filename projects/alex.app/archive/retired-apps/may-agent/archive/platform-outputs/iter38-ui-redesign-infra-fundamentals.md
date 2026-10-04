# UI Redesign: Infrastructure Fundamentals (iter38)

## Summary

Redesigned the web UI's Overview (formerly "Live") tab to foreground infrastructure
fundamentals per the hao directive and codex design advice.

## Changes

### Tab renaming
- **Live → Overview** — first screen is now about understanding the system
- **Metrics → Contracts** — reframes metrics as operational contracts
- **System → Events** — clearer about what the tab contains

### New panels on Overview (top-to-bottom order)

1. **Infrastructure substrate map** — 6-block grid showing: Event Bus, Metrics & Alerts,
   Session Runner, Project Handler, Persistence, SDK/API. Each shows live status and
   links to the evidence surface (Events tab, Contracts tab, etc.).

2. **"How the system works" lane** — visual control loop:
   Trigger → Handler/Workflow → Session+Tools → Events → Metrics/Eval → Project State.
   Includes a live link to the most recent event's loop trace.

3. **Core loops (formerly "System liveness")** — existing liveness panel with vitals,
   timeline, agents, decisions, alerts, messages. Now positioned below infra fundamentals.

4. **"What is this on?" panel** — shows runtime, repo path, DB location, data root,
   UI source, and docs path. Fetches from `/api/system-info` with sane fallbacks.

### Design principle applied
> The page makes the platform observable before it makes agents conversational.

Agents and projects remain visible but below the infrastructure map. The infrastructure
map is the first thing a user sees.

## Files modified
- `ui/index.html` — tab labels + new panel HTML structure
- `ui/pages/live.js` — `loadInfraMap()`, `loadLoopExample()`, `loadSubstrateInfo()` functions
- `ui/styles.css` — CSS for `.infra-map`, `.control-loop-lane`, `.substrate-panel`
- `ui/app.js` — init calls for new panels

## Validation
- `bun run check` passes (TypeScript clean)
- `web-mode.test.ts` passes
- No backend changes required — new panels use existing API endpoints with graceful fallbacks
