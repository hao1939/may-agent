# Finding: project-resume cron flow — layer count & indirection audit

**Lens:** B — Flow Complexity
**Scope:** cron.json entry → project-resume handler → callAgent → project file
**Date:** 2026-04-17

## Summary
The project-resume flow is **4 layers**, all load-bearing, no unnecessary indirection. The handler is self-contained (no intermediate dispatch modules, no extra wrappers). Recommend **no structural change**. One minor clarity nit noted below.

## Layer trace

1. **Cron entry** — `agents/may/cron.json:287-295`
   - `intervalMs: 300000` (5min), `handler: "project-resume"`, `enabled: true`, `offsetMs: 90000`.
   - The `message` field (`agents/may/cron.json:290`) is **unused** for handler-type jobs — the handler defines its own task string. See nit #1.

2. **Handler factory** — `agents/may/handlers/project-resume.ts:115-117`
   - Exports `create(ctx, entry)` per `HandlerModule` contract, returns an async tick function.

3. **Tick logic (single pass)** — `agents/may/handlers/project-resume.ts:118-172`
   - `scanProjects(agentsRoot)` at `:50-88` — fs walk of `agents/*/workspace/projects/*.md`, parses `**Status**: <val>` via `STATUS_RE` at `:32`.
   - `pickPerOwner(projects)` at `:94-102` — filters `status === "active"`, keeps most-recent mtime per owner.
   - `runningAgents(ctx)` at `:109-114` — one SQL: `SELECT DISTINCT agent FROM sessions WHERE status='running'`.
   - Per candidate: skip if owner in busy set (`:134-137`), else `ctx.manager.run(owner, task, { source: "cron" })` at `:155`.

4. **Target agent receives task** — synthetic task string at `project-resume.ts:139-143` points agent at `project.relPath` (e.g. `agents/coach/workspace/projects/prove-the-loop.md`). Agent reads the project file (e.g. `agents/coach/workspace/projects/prove-the-loop.md:3` `**Status**: active`) and continues the documented Iteration Loop (`prove-the-loop.md:14-21`).

## Layer count: 4
cron.json → handler factory → tick (scan+pick+busy-check+fork) → target agent reads project file.

No dispatch board, no intermediate queue, no wrapper agent. Scan-pick-fork is inlined in one handler. This is appropriate for a 5-min cron — adding layers would be overkill.

## Agent-confusion risk assessment
- Task string (`project-resume.ts:139-143`) is explicit: names the project file path, tells agent to check Status, and tells agent to update Status when blocked/done to stop the re-fork loop. **Clear.**
- Status vocabulary is documented in the handler docstring (`project-resume.ts:12-17`) and matches what projects use (`prove-the-loop.md:3` uses `active`). **Aligned.**
- `STATUS_RE` at `:32` anchors on `**Status**:` (bold markdown). Project file uses exactly that form (`prove-the-loop.md:3`). **Matches.**

## Severity: LOW (informational)
Flow is already minimal-layered. Nothing to fix. One micro-nit only.

## Nits (optional follow-ups — do not auto-fix)

**Nit #1 — redundant `message` field in cron entry.**
`agents/may/cron.json:290` has a `message` that is never consumed: the handler builds its own task string at `project-resume.ts:139-143`. For handler-type cron jobs, `message` is dead metadata. Harmless but mildly confusing when reading cron.json.
- Action (if ever worth it): drop `message` for all `type: "job"` entries with a `handler`, OR add a comment in cron.json explaining it's for human reference only. Low priority.

**Nit #2 — no per-run fork cap.**
`project-resume.ts:132-163` iterates all candidates unconditionally. With N agents each holding an active project, a single tick could fork N sessions at once. Current universe is small (~5-10 agents with projects), so not a real issue. Worth revisiting only if project count grows past ~20.

## Recommended action
**None.** Close the lens with "flow is clean". Optionally file nit #1 as a P3 cleanup; nit #2 as a watch-item.

## Follow-up (NOT this session)
- If someone wants to tidy: delete `message` from handler-type cron entries across `cron.json` (separate session, ~5 min).
