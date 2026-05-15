# Heartbeat Efficiency: Conditional Skip Design (M2)

## 1. Definition of "Meaningful Change Since Last Heartbeat"

A heartbeat should RUN if any of these conditions are true since the last productive heartbeat:
- New human message or input directed at the agent
- Project status change (new project, milestone completion, blocker resolved)
- Metric breach or threshold crossing in a monitored project
- Failed session requiring remediation
- New unresolved alert or notification
- Relevant file change in watched paths (e.g., project.md updates)
- Elapsed time exceeds maximum silence interval (e.g., 4 hours) — forced heartbeat

A heartbeat should SKIP if none of the above conditions are true.

## 2. Skip/Run Decision Table

| Condition | Action | Rationale |
|-----------|--------|-----------|
| New human message since last HB | RUN | Responsiveness to humans is paramount |
| Project status change | RUN | Agent should react to state transitions |
| Metric breach / threshold alert | RUN | Proactive intervention needed |
| Failed session since last HB | RUN | May need retry or escalation |
| New unresolved notification | RUN | Agent should triage |
| File change in watched paths | RUN | React to external changes |
| Max silence interval exceeded | RUN | Liveness proof / periodic scan |
| None of the above | SKIP | No-op expected; save cost |

## 3. State Model

Track per-agent:
```typescript
interface HeartbeatState {
  lastProductiveHeartbeatTs: number;    // epoch ms of last RUN heartbeat
  lastCheckedEventId: string | null;    // cursor into event/session log
  lastCheckedFileHashes: Record<string, string>; // watched file → hash
  consecutiveSkips: number;             // for max-silence forcing
}
```

Storage: `.state/heartbeat-state.json` per agent, read/written at heartbeat trigger time.

## 4. Insertion Point in `src/`

The conditional skip must execute **before** a full agent session is launched. Candidate insertion points:
- `src/sessions/manager.ts` — if heartbeat sessions are created here, add a guard before `createSession()`.
- `src/workflows/dispatch.ts` or equivalent dispatcher — intercept heartbeat-type dispatches.
- `src/cron/handler.ts` or cron tick handler — earliest point, before workflow selection.

The ideal point is wherever the cron tick translates into a session/workflow invocation. The skip logic should:
1. Load `HeartbeatState` from disk.
2. Query for new events/messages since `lastCheckedEventId`.
3. If no meaningful change → log skip, increment `consecutiveSkips`, save state, return early.
4. If meaningful change → proceed normally, reset state after session completes.

## 5. Reusable Logic from Existing Implementations

| File | Reusable? | Notes |
|------|-----------|-------|
| `circuit-breaker.ts` | Partial | Has consecutive-failure tracking and cooldown logic; adapt for consecutive-skip ceiling |
| `dispatch-dedup-guard.ts` | Yes | Already implements "don't dispatch if recent identical dispatch"; core dedup pattern applies |
| `heartbeat-data.ts` | Yes | Has event-query helpers for checking recent activity; use for change detection |

## 6. M3 Implementation Sketch

1. Create `src/heartbeat/conditional-skip.ts` with:
   - `shouldSkipHeartbeat(agent: string): Promise<boolean>`
   - Change-detection queries (messages, events, file hashes)
   - State persistence (read/write heartbeat state)
2. Integrate into cron/dispatch path with early-return guard.
3. Add lightweight skip logging (append to `.state/heartbeat-skips.log` or emit structured event).
4. Add bypass flag for manual/forced heartbeats.
5. Tests: mock event sources, verify skip/run decisions match decision table.
