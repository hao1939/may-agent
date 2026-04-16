# Adaptive Heartbeats

**Owner:** may
**Goal:** Stop wasting sessions when there's nothing to do.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](./system-evolution.md) → Gap 4
**Source feedback:** [scout](../../scout/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `system.agent-utilization`, `system.request-throughput`

## Why
Agents fire heartbeats on fixed intervals regardless of whether there's work. Scout runs every 30min even when arXiv hasn't updated. Coach checks in when no experiments are running. Each idle heartbeat costs 5-15 ops for zero value.

## Milestones

- [ ] **Conditional heartbeat — fast exit** — If nothing needs attention (no new requests, no stale work, no errors), exit in ≤2 ops. Don't read 5 files to confirm there's nothing to do.
- [ ] **Scout: skip heartbeats between arXiv windows** — arXiv updates at known times. Scout shouldn't poll between them.
- [ ] **Adaptive frequency** — Run more often during active periods (when Hao is online, when work is dispatched), less during quiet hours. May controls the cron intervals dynamically.

## Progress Log
<!-- Append entries as milestones are completed -->

### Iteration 1 — 2026-04-16T12:38:05.252Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (1m54s)

**Files modified:**
- agents/shared/may-agent-docs/design/adaptive-heartbeats.md

**Files read (not modified):**
- agents/may/workspace/projects/adaptive-heartbeats.md

**Errors encountered:**
- [bash] 1 | 
2 | import {Database} from 'bun:sqlite';
3 | const db = new Database('.state/may.db', {readonly:true});
4 | const rows = db.query(`SELECT created_at, substr(task,1,60) as task, duration_seconds, status FROM sessions WHERE agent='bob' AND task LIKE '%heartbeat%' ORDER BY created_at DESC LIMIT 30

**Agent response:**
Now verify and commit:
**Files touched**: (see worker session)
**Owner assessment**: DONE — — Solid design doc produced. It has data-driven problem analysis (65% idle heartbeats across agents), a layered solution (fast-exit gate → adaptive frequency → scout windowing), concrete implementation phases, estimated savings (~45 sessions/day, ~425 ops/day), and risk mitigations. Phase 1 is actionable immediately as a prompt-only change. Ready for review and Phase 1 deployment.


### Iteration 2 — 2026-04-16T13:22:32.362Z
**Worker task**: Iteration 2 — work toward goal
**Worker result**: **Status:** done (10s)

**Agent response:**
The owner guidance says "DONE" — the design doc is complete and ready for review/Phase 1 deployment. There's no more work needed on this task.
**Files touched**: (see worker session)
**Owner assessment**: DONE — — Design doc complete at `agents/shared/may-agent-docs/design/adaptive-heartbeats.md`. Iteration 2 correctly recognized no further work needed. Ready for Hao review and Phase 1 deployment.

