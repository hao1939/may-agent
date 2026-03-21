# Implementation Plan: Active Nudging (Control Plane Phase 3)

**Source**: Bob's `brief-active-nudging.md` (Wink Pattern, arXiv:2602.17037)
**Status**: ✅ Phase 1 COMPLETE — Detection + Output | 🔲 Phase 2 TODO — Handler + Cron

## What Was Implemented (Phase 1 — 2026-03-21)

### 1. `monitor-session.cjs` — New Detections

Added two new detection functions and intervention payloads:

- **`detectGhostDeliverable(entries)`** (FM-3.1): Scans last 5 assistant messages for file path claims (wrote/created/saved patterns + finish() deliverables). Checks if those files exist on disk. Fires if ≥50% of claimed files are missing. Output: `GHOST_DELIVERABLE` status with `intervention.message`.

- **`detectProductivityStall(toolCalls, entries)`** (FM-2.6): Fires when 10+ tool calls have been made with zero file writes (write/edit/bash-redirect). Categorizes read-only spinning. Output: `PRODUCTIVITY_STALL` status with `intervention.message`.

- **Enhanced LOOP detection** (FM-1.3): Existing `detectLoop()` unchanged, but its result now includes an `intervention` payload with the nudge message.

### 2. JSON Output Enhancement

The `main()` output now includes an `interventions` array when actionable nudges are detected:
```json
{
  "interventions": [
    {
      "sessionId": "s_xxx",
      "agent": "coder",
      "status": "LOOP",
      "type": "loop",
      "message": "[SYSTEM NOTICE] Loop detected. You have called read 4 times...",
      "action": "interrupt",
      "confidence": 0.95
    }
  ]
}
```

## What Remains (Phase 2 — TODO for Coder)

### 3. `agents/may/handlers/active-nudge.ts` — NOT YET BUILT

**Design** (Bob's brief § 3, Option C via May's cron):

```typescript
// active-nudge.ts — runs every 5 min via cron
// 1. Calls: node agents/evaluator/skills/monitor-session.cjs --running
// 2. Parses JSON output for `interventions` array
// 3. For each intervention with action "interrupt":
//    - manager.cancel(sessionId) — kills the stuck session
//    - Logs the intervention to .state/nudge-log.jsonl
// 4. For each intervention with action "warn":
//    - Writes nudge file to agents/<agent>/workspace/nudge-active.md
//    - File is picked up by next heartbeat context injection
```

**Key constraint**: No `manager.inject(sessionId, message)` API exists. We must use:
- **Cancel+restart** for hard interventions (loops, ghost deliverables) — same pattern as watchdog
- **Workspace file** for soft interventions (productivity stalls) — picked up by heartbeat-context

### 4. Cron Entry — NOT YET ADDED

```json
{
  "name": "active-nudge",
  "type": "job",
  "handler": "active-nudge",
  "intervalMs": 300000,
  "enabled": true,
  "description": "Active Nudge: detect loops/stalls/ghosts in running sessions and intervene (5min)"
}
```

## Decision: Why Cancel+Restart Instead of Inject

The Wink paper's ideal is mid-stream injection, but our architecture doesn't support it (sessions are stateless message streams). The effective equivalent:
1. Cancel the broken session
2. Log the failure pattern
3. The agent's next heartbeat naturally restarts with fresh context + the error log

This is identical to what the watchdog already does for timeouts. The innovation here is **behavioral detection** (loops, ghosts, stalls) instead of just time-based.

## Files Modified
- `agents/evaluator/skills/monitor-session.cjs` — +2 detection functions, +3 intervention payloads, +exports
