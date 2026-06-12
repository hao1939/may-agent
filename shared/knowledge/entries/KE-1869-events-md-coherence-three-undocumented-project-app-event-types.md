<ai_context>
events.md design doc was missing three live event types emitted by project-app code: project.tick (4 rows, schedule-driven), project.problem.requested (1 row, problem-solver trigger), and project.problem.escalated (1 row, problem resolution). All three are emitted by aks-rp-e2e.app/app.ts and/or platform/.app/app.ts. Fixed in-place in events.md. Also refreshed session.resume_failed count from 818→897.
Triggers: events.md, project.tick, project.problem, coherence audit, design doc drift, project-app
</ai_context>

# KE-1869: events.md Coherence — Three Undocumented Project-App Event Types

**Status**: resolved
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc completeness
**Related**: KE-1866 (sessions.md drift), KE-1865 (cron.md drift), KE-1785 (events.md prior drift)

## Claim

Three live event types were present in the `events` table but absent from the
canonical taxonomy in `shared/may-agent-docs/2a-design/events.md`.

## Evidence

### Missing event types found via `SELECT DISTINCT event_type`

| Event type | Rows (7d) | Emitter | Why undocumented |
|---|---|---|---|
| `project.tick` | 4 | `project-app:aks-rp-e2e:schedule:regular-learning` | Emitted by project-app `app.ts` schedule entries, not the core runtime |
| `project.problem.requested` | 1 | `control` (codex-initiated) | Part of aks-rp-e2e problem-solver workflow, added post-taxonomy census |
| `project.problem.escalated` | 1 | `agent:aks-explorer` | Companion to `project.problem.requested`; fires when fix is applied |

### Source code verification

All three event types are emitted from project-app code:
- `/app/projects/aks-rp-e2e.app/app.ts` — emits all three
- `/app/projects/platform/.app/app.ts` — emits `project.tick` only

These are **not** core runtime events but project-app-scoped signals. The
events.md taxonomy had not been updated when the project-app execution engine
matured and added these event types.

### Row count refresh

`session.resume_failed` count updated from 818 (2026-06-12 census) to 897
(2026-06-13 census). Rate remains stable at ~12/hour. Breakdown: 57% planner
sessions (200/352 in last 24h), 43% task sessions (151/352).

## Action

Added all three event types to the "Project lifecycle — planning & watchdog"
table in `events.md`. Updated `session.resume_failed` row count and breakdown.

## Pattern

Project-app event types are a growing category. As more projects adopt the
`project-app` pattern (v2/v3 project execution engine), their custom event
types will need to be surfaced in the taxonomy or a dedicated "project-app
extensions" section. Currently only aks-rp-e2e and platform use project-apps.
