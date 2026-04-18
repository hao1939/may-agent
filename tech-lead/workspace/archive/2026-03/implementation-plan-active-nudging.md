# Implementation Plan: Active Nudging (Control Plane Phase 3)

**Source**: Bob's `brief-active-nudging.md` (Wink Pattern, arXiv:2602.17037)
**Status**: ✅ COMPLETE — All phases implemented (2026-03-21)

## Phase 1 — Detection + Output (COMPLETE 2026-03-21 ~06:00Z)

### `monitor-session.cjs` — New Detections
- **`detectGhostDeliverable(entries)`** (FM-3.1): Scans for file path claims, checks disk. Fires if ≥50% missing.
- **`detectProductivityStall(toolCalls, entries)`** (FM-2.6): Fires when 10+ tool calls with zero writes.
- **Enhanced LOOP detection** (FM-1.3): Now includes intervention payload with nudge message.
- JSON output includes `interventions` array when actionable nudges detected.

## Phase 2 — Handler + Cron (COMPLETE 2026-03-21 ~15:40Z)

### `agents/may/handlers/active-nudge.ts` — NEW
Handler following watchdog.ts pattern:
- Invokes `monitor-session.cjs --running` via `execSync`
- Handles exit code 1 (unhealthy sessions = expected, parses stdout)
- For `action === "cancel"` → `ctx.manager.cancel(sessionId)` 
- For `action === "warn"/"nudge"` → writes `nudge-active.md` to agent workspace
- 10-minute cooldown per session via `.state/nudge-log.jsonl`
- All interventions logged to `.state/nudge-log.jsonl`

### `agents/may/cron.json` — UPDATED
Added `active-nudge` entry: 5min interval, handler-based job.

## Phase 3 — Context Awareness (COMPLETE 2026-03-21 ~21:10Z)

### `agents/may/handlers/heartbeat-context.ts` — UPDATED
- Now checks for `nudge-active.md` in each agent's workspace before writing context
- If found, prepends nudge content with `# ⚠️ URGENT — Active Nudge` header
- Logs count of injected nudges in summary notification

### `agents/shared/bulletin.md` — UPDATED
- Added bulletin entry instructing all agents to check `workspace/nudge-active.md` during heartbeats
- Bob's heartbeat already has native nudge-active.md check (line 89)
- Other agents: bulletin serves as cross-cutting notification until individual heartbeats are updated
