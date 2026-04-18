# Activity Tracking — Tech Lead Feasibility Review

**Date**: 2026-03-15
**Source**: `agents/may/workspace/brief-activity-tracking.md`
**Verdict**: **FEASIBLE ✅** — ~130–150 lines, clean integration with existing manager.ts lifecycle hooks.

## Design Question Answers

### Q1: Progress event frequency
**Option A — every 5 turns.** Simple, predictable, uses existing `session.turnCount`. `extractLastAssistantText()` is already implemented. The progress summary can be the last ~100 chars of assistant text. No need for semantic analysis.

### Q2: activity.jsonl max size / rotation
**Option A — no rotation for MVP.** Each line ~200 bytes × 5000 events = 1MB. We'd need months of continuous operation to hit that. Simpler code, fewer edge cases.

### Q3: Auto-notify-May
**Option D — `onSessionBlocked` callback in `SubagentManagerOptions`.** Mirrors existing `onSessionComplete` callback. Startup code in `launcher.ts` adds the handler. No need to know May's session ID at build time — the callback receives the blocked event and routes at runtime.

### Q4: How agents signal "blocked"
**Option A — new `report_blocked` tool.** Clean, explicit, doesn't terminate session. ~25 lines. Manager intercepts tool result, writes activity event, fires `onSessionBlocked` callback.

### Q5: Separate from handleCompletion?
**Yes.** activity.jsonl is a parallel observability layer. Different file, format, purpose from .state/sessions/ and .state/memory/. Add append calls inside `handleCompletion`, right after `appendMemory()`. ~10 lines.

## Implementation Plan

### Phase 1: Core Activity Logging (~80 lines)
1. **New file: `src/lib/activity.ts`** (~20 lines) — `appendActivity()` helper
2. **`ActiveSession` extension** in `src/lib/manager-utils.ts` (~2 lines) — `filesModified: Set<string>`
3. **Integration in `src/lib/manager.ts`**:
   - `run()` L665: `start` event after session creation
   - `subscribeForPersistence()` L210: `progress` event when `turnCount % 5 === 0`
   - `handleCompletion()` L534: `done`/`error` event after `appendMemory()`
4. **File tracking** (~15 lines) — detect `write`/`edit` tool calls, extract path, add to `session.filesModified`

### Phase 2: Blocked Escalation (~50 lines)
1. **New tool: `src/lib/tools/report-blocked.ts`** (~25 lines)
2. **`onSessionBlocked` callback** in `SubagentManagerOptions` (~5 lines type def)
3. **Wire callback in launcher.ts** (~15 lines)
4. **Wire `report_blocked` tool** in `src/app/agent-loader.ts` tool presets (~5 lines)

### Phase 3: System-status integration (~20 lines)
- `src/lib/tools/system-status.ts`: read latest N activity.jsonl entries per agent, surface "currently working on" + "blocked" in dashboard

## Risk Assessment
- **Low risk**: All changes additive. No modifications to existing data flow.
- **Testing**: 15-20 tests covering event emission, file tracking, callback firing, malformed input.
- **No behavioral changes**: Activity events are fire-and-forget — failures logged but don't crash sessions.

## Errors to Avoid (from ERROR_LOG.jsonl)
- Prior session `s_1773575769880_1161` attempted this implementation and failed due to tool schema violations and path confusion (`src/app/manager.ts` doesn't exist — correct path is `src/lib/manager.ts`).
- TSC timeouts are infrastructure — use vitest for verification, accept TSC may not complete.

## Status
**Ready to implement when directed by May/Hao.** Hao directive overrides Consolidation Mode.
