# Activity Tracking + Escalation Path — Design Brief

**From**: Hao (via review agent) → May  
**Date**: 2026-03-15  
**Status**: Design review needed from Bob (architecture) + Tech-Lead (implementation feasibility)

## Problem Statement

1. Hard to know what each agent is working on, what they did, what's blocked
2. Some agents are silently blocked but don't escalate — things sit for hours unnoticed
3. Current tracking is fragmented: todo.md (10 files, stale), SIGNALS.md (4814 lines), meta.json (no summary), focus-tasks.md (unclear what's current)

## Proposed Solution: `activity.jsonl` per agent

One append-only file per agent: `agents/<name>/workspace/activity.jsonl`

### Event Types

**start** — session created:
```json
{"ts":1773574054,"event":"start","sid":"s_1773574054340_1115","agent":"tech-lead","task":"Implement Layer 2 memory consistency"}
```

**progress** — periodic status update (every N turns):
```json
{"ts":1773574200,"event":"progress","sid":"s_1773574054340_1115","turns":5,"summary":"Created memory-consistency.ts, writing tests"}
```

**done** — session completed successfully:
```json
{"ts":1773574890,"event":"done","sid":"s_1773574054340_1115","turns":12,"duration":"13m56s","summary":"Created memory-consistency.ts (145 lines), 8 tests pass","files":["src/lib/memory-consistency.ts"]}
```

**error** — session failed:
```json
{"ts":1773575900,"event":"error","sid":"s_1773574500000_1130","turns":9,"duration":"8m44s","summary":"bun build fails","error":"BunBuildError"}
```

**blocked** — agent explicitly reports being blocked:
```json
{"ts":1773576100,"event":"blocked","sid":"s_1773574600000_1135","turns":3,"summary":"Need npm publish credentials","blocker":"waiting on human: npm publish credentials"}
```

### Where Each Event is Written (all in manager.ts, automatic)

| Event | Where | How |
|-------|-------|-----|
| `start` | `run()` — after session creation | Append to `agents/<name>/workspace/activity.jsonl` |
| `progress` | `subscribeForPersistence()` — on `message_end` when `turnCount % N === 0` | Extract `lastAssistantText` summary |
| `done` | `handleCompletion()` → after `appendMemory()` | Already has all data |
| `error` | `handleCompletion()` → when `archiveStatus === "error"` | Already has error field |
| `blocked` | New: agent calls `report_blocked` tool | Manager intercepts, writes event, notifies May |

### Files-Modified Tracking

Collect paths from `write`/`edit` tool calls during session. Accumulate on `session` object (new `filesModified: Set<string>` field on `ActiveSession`). Include in `done`/`error` events.

## Escalation Path

### Detection Mechanisms

1. **Explicit**: Agent calls `report_blocked({ reason: "..." })` tool
2. **Turn stall**: Session running N turns with repeated failures (later, not MVP)
3. **Session timeout**: Hits maxTurns without finish (already tracked via handleCompletion)

### Escalation Chain

```
Agent is blocked
  → writes "blocked" event to activity.jsonl
  → manager auto-sends message to May's session (via input() or steer())
  → May decides: fix herself, delegate elsewhere, or escalate to Hao via Telegram
```

Key: **manager pushes to May**, agent doesn't need to know how to reach May.

## Open Design Questions (For Bob + Tech-Lead)

### Q1: Progress event frequency
- **Option A**: Every N turns (e.g., every 5). Simple, predictable.
- **Option B**: Only on meaningful state changes (tool calls that modify files). More signal, harder to implement.
- **Recommendation**: Start with Option A (every 5 turns). The summary comes from `extractLastAssistantText()` which is already implemented.

### Q2: activity.jsonl max size / rotation
- **Option A**: No rotation. Files grow forever. `jq` handles it fine.
- **Option B**: Rotate at 1MB. Move old to `activity.jsonl.1`.
- **Option C**: Prune entries older than 7 days on append.
- **Recommendation**: Option A for MVP. Each line ~200 bytes, so 1MB = ~5000 events = weeks of activity.

### Q3: How should auto-notify-May work?
- **Option A**: `manager.input(maySessionId, "Agent X is blocked: ...")` — requires knowing May's session ID.
- **Option B**: `manager.steer(maySessionId, ...)` — same but doesn't wait for idle.
- **Option C**: Write to `agents/may/workspace/escalations.jsonl`. May checks on heartbeat. Lower coupling, delays notification ~1min.
- **Option D**: Use existing `onSessionComplete` callback pattern — add `onSessionBlocked` callback in SubagentManagerOptions.
- **Recommendation**: Option D (callback) for the mechanism. The startup code that sets `onSessionComplete` can also set `onSessionBlocked` to route to May's session.

### Q4: How should agents signal "blocked"?
- **Option A**: New standalone tool: `report_blocked({ reason: "...", blocker: "..." })`. Agent continues running (can save partial work). Manager writes activity event + notifies May.
- **Option B**: Convention-based detection (fragile, not recommended).
- **Recommendation**: Option A. Clean, explicit, doesn't terminate the session.

### Q5: Should done/error be separate from what handleCompletion already does?
- `handleCompletion` already updates registry, calls `onSessionComplete`, appends memory, archives session.
- Activity events are **additional** — different file, different format, different purpose (agent workspace vs .state/).
- **Recommendation**: Yes. Add activity.jsonl append calls inside `handleCompletion`, right after `appendMemory()`. ~10 lines.

## Implementation Estimate

| Component | Lines | File |
|-----------|-------|------|
| `ActiveSession.filesModified` field | 2 | manager-utils.ts |
| Collect file paths from write/edit tool results | 10 | manager.ts (subscribeForPersistence or tool wrapper) |
| `appendActivity()` helper function | 15 | new: activity.ts |
| Start event in `run()` | 3 | manager.ts |
| Progress event in `subscribeForPersistence()` | 8 | manager.ts |
| Done/error event in `handleCompletion()` | 10 | manager.ts |
| `report_blocked` tool | 25 | new: tools/report-blocked.ts |
| Auto-notify-May on blocked (callback) | 15 | manager.ts |
| system-status reads activity.jsonl | 20 | system-status.ts |
| **Total** | **~108** | |

## What NOT to Build

- No polling daemon — event-driven in existing turn loop
- No new agent convention to follow — it's automatic (except optional `report_blocked` tool)
- No separate audit system — evaluator can cross-reference later
- No web dashboard — `tail + jq` is enough
- No changes to existing persistence format (meta.json, memory.jsonl stay as-is)

## Codebase Context for Implementer

Key files:
- `src/lib/manager.ts` (1775 lines) — session lifecycle: `run()` (L561), `subscribeForPersistence()` (L202), `handleCompletion()` (L419), `buildResultFromSession()` (L1139)
- `src/lib/manager-utils.ts` — `ActiveSession` interface (L162), `RunOptions` (L212)
- `src/lib/tools/system-status.ts` — current dashboard tool
- `src/lib/persistence.ts` — registry, memory, session archive functions

Key integration points:
1. **Session creation**: `run()` L665 — add `start` event after `this.activeSessions.set(sessionId, session)`
2. **Turn counting**: `subscribeForPersistence()` L210 — add progress event check after `session.turnCount++`
3. **Session end**: `handleCompletion()` L534 — add done/error event after `this.appendMemory(session)`
4. **File tracking**: Either in `wrapToolsWithReceipts()` or in the subscribe callback via tool_result events
5. **onSessionBlocked callback**: In SubagentManagerOptions alongside existing `onSessionComplete`
