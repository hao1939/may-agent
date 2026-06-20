---
id: KE-2068
title: "May Heartbeat Not Fully Disabled — Event-Reactive Trigger Path Fires 1-2x/day"
date: 2026-06-20
author: arc
status: active
tags: [coherence, heartbeat, may, cron, architecture-drift, event-reactive]
related: [KE-2053, KE-2065, KE-2067]
last_verified: 2026-06-20T03:15Z
---

<ai_context>
summary: "heartbeat.md Status (2026-06-18) states 'May's heartbeat is disabled — may runs through event-driven workflows (steward, alert-triage, owner-review) instead.' The cron.json entry is `enabled: false` with _disabled_reason from 2026-06-15. However, may-heartbeat sessions still occur: 106 in the last 7 days (concentrated Jun 13-15 before the disable, but 2 in the last 48h). The mechanism: cron.ts subscribeToBus() reacts to `heartbeat.trigger` events and triggers the may heartbeat entry regardless of `enabled` status (line ~510: triggerNow with force:true). Additionally, the P0 message delivery path in message-tool.ts triggers a heartbeat for the receiving agent. The doc should clarify that the *cron-scheduled* heartbeat is disabled but the *event-reactive* path remains active. Current effective cadence: ~1-2x/day (down from 48/day when fully enabled)."
triggers: [coherence-audit, heartbeat design doc vs reality]
falsifiers:
  - F1: "If triggerNow respects the enabled:false flag and stops dispatching, the heartbeat becomes truly disabled." — Watch may-heartbeat sessions for 7 days.
  - F2: "If the 2/48h sessions are caused by a specific trigger (e.g., P0 message delivery), the reactive path is intentional and should be documented rather than fixed." — Grep handler.started events for may heartbeat trigger source.
  - F3: "If may-agent.app's platform-review schedule fully replaces the heartbeat function, the remaining reactive dispatches are pure waste." — Compare may's workflow:platform-owner-review sessions (66/48h) with workflow:may-heartbeat sessions (2/48h).
</ai_context>

# KE-2068: May Heartbeat Not Fully Disabled — Reactive Trigger Still Active

## Observation

`projects/may-agent.app/docs/2a-design/heartbeat.md` Status note (2026-06-18):
> May's heartbeat is disabled — may runs through event-driven workflows (steward, alert-triage, owner-review) instead.

`agents/may/cron.json` heartbeat entry:
```json
"enabled": false,
"_disabled_reason": "Redundant with may-agent.app platform-review (4h schedule) — 2026-06-15"
```

**But sessions still fire:**

| Period | may-heartbeat sessions |
|--------|----------------------|
| 2026-06-13 | 38 |
| 2026-06-14 | 47 |
| 2026-06-15 (disable day) | 19 |
| 2026-06-16 - 2026-06-18 | 0 |
| 2026-06-19 | 1 |
| 2026-06-20 (today) | 1 |

## Mechanism

The cron system has two dispatch paths:

1. **Timer path** (respects `enabled: false`): interval-based fires → disabled for may.
2. **Event-reactive path** (ignores `enabled`): `subscribeToBus()` in `cron.ts` listens for `heartbeat.trigger` events and calls `triggerNow(entryName, { force: true })`. The `force: true` bypasses the enabled check.

Additionally, the `heartbeat` internal event emitted when any other heartbeat entry fires (line 932: `if (entry.name.startsWith("heartbeat"))`) can cascade-trigger other heartbeat entries via the bus subscription.

## Impact

**Low severity.** The reactive may-heartbeat fires ~1-2x/day (vs the old 48/day). May's main work load is now `workflow:platform-owner-review` (66 sessions/48h). The occasional heartbeat session produces value (done status, avg 36 opCount) so it's not harmful — just undocumented.

## Contradiction Scope

- `heartbeat.md` says "disabled" — partially incorrect
- `cron.json` says `enabled: false` — correct for timer path but not reactive path
- Agents reading the doc may assume may never runs heartbeats — minor context pollution

## Recommended Fix

Update heartbeat.md status note to:
> May's cron-scheduled heartbeat is disabled (`enabled: false` since 2026-06-15).
> However, the event-reactive trigger path (`on: ["heartbeat.trigger"]`) still fires
> sporadically (~1-2x/day) via `force: true` in `cron.ts subscribeToBus()`.
> May's primary work loop is the `platform-owner-review` workflow (4h schedule).

Or, to truly disable: remove the `on: ["heartbeat.trigger"]` from may's cron.json entry, or add `"heartbeat": false` to `agents/may/agent.json`.
