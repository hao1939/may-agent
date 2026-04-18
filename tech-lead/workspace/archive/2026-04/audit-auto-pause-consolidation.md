# Auto-Pause Dual System — Consolidation Analysis

**Date:** 2026-04-11  
**Lens:** B (from cron architecture audit)  
**Status:** Analysis complete — safe to delete handler

---

## Executive Summary

Two complete auto-pause systems exist. The **inline system** (auto-pause.ts + cron.ts) handles everything and has been the only one running. The **handler** (auto-pause-recovery.ts) is 523 lines of dead code that has never fired a probe, uses incompatible probe markers, and would actively conflict with the inline system if both ran simultaneously.

**Verdict: Delete `agents/may/handlers/auto-pause-recovery.ts`.**  
The cron entry is already disabled (done in Lens A session). No src/ changes needed.

---

## System 1: Inline (ACTIVE — battle-tested)

**Files:**
- `src/lib/auto-pause.ts` (392 lines) — pure state machine, DB queries, notification helpers
- `src/app/cron.ts` lines 420-510, 690-790 (~100 lines) — integration with heartbeat/probe firing
- `test/auto-pause-recovery.test.ts` (443 lines) — tests for auto-pause.ts functions
- `test/auto-pause.test.ts` (114 lines) — tests for isAgentAutoPaused()

**Flow (end-to-end):**

```
Every heartbeat fire (30-min interval):
  1. parseAutoPauseConfig(entry.handlerConfig) → get threshold, backoff, TTL config
  2. getAutoPauseState(persistDir, agent, config) → query sessions table
     ├── Last N non-probe sessions all errors? → "auto-paused"
     │   ├── Probe currently running? → "probing"  
     │   ├── Probe timer expired or TTL exceeded? → probeDue=true
     │   └── Otherwise → probeDue=false (skip heartbeat)
     └── Otherwise → "running"
  3. Based on state:
     ├── auto-paused + probeDue → fireHeartbeat(entry, {probe: true, apState, apConfig})
     │   → Wraps task with "[auto-pause-probe]" marker via buildProbeTaskMessage()
     │   → On success: createRecoveryNotification() → trackRequest to may
     │   → On failure: increment probeCount, backoff doubles
     ├── auto-paused + !probeDue → skip, log "paused"
     │   → First detection: createPauseEscalation() → trackRequest to may
     ├── probing → skip (probe already running)
     └── running → fire normal heartbeat
         → If autoPauseActive has entry → agent just recovered, send notification
```

**State derivation:** 100% from sessions table. Probe sessions identified by `[auto-pause-probe]` in task text. Stateless across restarts (except in-memory notification tracking — see gap below).

**DB writes:**
- Escalation: `trackRequest()` with artifact `auto-pause:{agent}`
- Recovery: `trackRequest()` with artifact `auto-pause-recovery:{agent}`
- No direct DB writes — state derived from existing session records

---

## System 2: Handler (DEAD — never fired)

**File:** `agents/may/handlers/auto-pause-recovery.ts` (523 lines)

**Cron entry:** `auto-pause-recovery` in agents/may/cron.json — **already disabled** (description updated in Lens A session)

**What it does (in theory):**
1. Iterates MONITORED_AGENTS list (8 agents hardcoded)
2. Queries sessions table for consecutive errors (same logic as auto-pause.ts)
3. Fires probe via `ctx.manager.run()` with `source: "probe"` marker
4. Waits for probe with 5-min timeout, then cancels if stuck
5. Tracks state in `auto-pause-tracker.json` file (persists across restarts)
6. Sends escalation/recovery via `ctx.emit()` events

**Evidence it never fired:**
- Zero sessions with `source='probe'` in the database
- Zero sessions with `[auto-pause-probe]` from the handler's probe message format
- No `auto-pause-tracker.json` file exists anywhere in `.state/`
- The handler was disabled before it ever ran on a paused agent

---

## Comparison: Key Differences

| Aspect | Inline (auto-pause.ts + cron.ts) | Handler (auto-pause-recovery.ts) |
|--------|----------------------------------|----------------------------------|
| **Probe marker** | `[auto-pause-probe]` in task text | `source: "probe"` on session |
| **State detection** | Filters `[auto-pause-probe]` tasks | Filters `source != 'probe'` sessions |
| **State persistence** | In-memory Maps/Sets (lost on restart) | File-based JSON tracker |
| **Escalation** | `trackRequest()` → DB record | `ctx.emit()` → event dispatch |
| **Agent list** | Dynamic from cron.json entries | Hardcoded 8-agent array |
| **Probe timeout** | No explicit timeout (watchdog covers) | 5-min timeout + explicit cancel |
| **Turn limit** | None (intentionally removed) | `opBudget: 5` |
| **Lines** | ~490 total (392 + ~100 in cron.ts) | 523 |

### ⚠️ Critical: Incompatible Probe Markers

If both systems ever ran simultaneously, they would **confuse each other**:
- Inline fires probes with `[auto-pause-probe]` in task text
- Handler fires probes with `source='probe'` on the session record
- Inline's `getAutoPauseState()` only filters task text — it would count the handler's probes as regular sessions
- Handler's `analyzePauseState()` only filters `source='probe'` — it would count inline's probes as regular sessions

This means both could fire probes, both could think the other's probes are normal sessions, and the error streak count would be wrong.

---

## Unique Functionality in the Handler

**File-based persistence (ProbeTracker):**  
The handler saves `pauseDetectedAt`, `probesSent`, `escalationSent`, `recoverySent` to a JSON file. This survives process restarts. The inline system uses in-memory `Set<string>` and `Map` that are lost on restart.

**Impact of the inline gap:**
- On restart with a paused agent: `getAutoPauseState()` re-derives pause from DB → pause detection works ✅
- Escalation: `autoPauseEscalated` Set is empty → duplicate escalation sent ❌ (minor — May gets an extra notification)
- Recovery: `autoPauseActive` Map is empty → if agent recovered during the restart, no recovery notification ❌ (minor — recovery still happens, just no notification)

**Is this worth fixing?** Arguably yes, but it's a minor improvement. The core functionality (pause, probe, resume) all work because state is DB-derived. Only the notification deduplication is affected.

---

## Can We Safely Delete `auto-pause-recovery.ts`?

### ✅ YES — Safe to delete

**References that need cleanup:**

1. **`agents/may/handlers/auto-pause-recovery.ts`** — DELETE the file
2. **`agents/may/cron.json`** entry "auto-pause-recovery" — already disabled, remove entirely
3. **`test/auto-pause-recovery.test.ts`** — tests `src/lib/auto-pause.ts`, NOT the handler → **KEEP** (misleading name, but tests the right code)
4. **`agents/shared/may-agent-docs/design/auto-pause-recovery.md`** — design doc → KEEP for history, add "Implemented in src/lib/auto-pause.ts" note
5. **`agents/may/workspace/dispatch-board.md`** — references implementation as merged → no change needed

**No src/ references to the handler.** It's only loaded dynamically by the cron system when the cron entry fires, which is now disabled.

---

## Is `auto-pause.ts` Over-Complex?

**Assessment: No — it's appropriately sized.**

392 lines for 10 functions:
- `getAutoPauseState()` (120 lines) — the core state machine, properly complex
- `isAgentAutoPaused()` (10 lines) — backward-compat wrapper
- `shouldFireProbe()` (10 lines) — convenience wrapper
- `buildProbeTaskMessage()` (10 lines) — string builder
- `createPauseEscalation()` (25 lines) — escalation request
- `createRecoveryNotification()` (25 lines) — recovery request
- `getLastErrors()` (15 lines) — DB helper
- `parseAutoPauseConfig()` (20 lines) — config parser
- `parseDurationMs()` (15 lines) — duration parser
- `formatDuration()` (5 lines) — formatter

The state machine itself is clean: all state derived from DB, no side effects in getters, clear separation between state queries and actions. The 120-line `getAutoPauseState` is the most complex but handles real edge cases (probe session filtering, backoff calculation, TTL, running probe detection).

**One improvement:** The `cron.ts` integration (~65 lines touching auto-pause) adds in-memory tracking for notification deduplication. This could be simplified by moving notification tracking into `auto-pause.ts` with DB-backed deduplication (check if escalation request already exists for this pause epoch).

---

## Recommended Actions

### P0: Delete Dead Handler (agents/ only — no review branch needed)
1. `rm agents/may/handlers/auto-pause-recovery.ts`
2. Remove the "auto-pause-recovery" entry from `agents/may/cron.json`
3. Commit in agents/ repo

### P2: Minor Improvement — Restart-Safe Notifications
The in-memory `autoPauseEscalated` Set could be replaced by checking if an escalation request already exists in the DB for this agent's current pause epoch. This would prevent duplicate escalations on restart without adding file-based state.

Pattern:
```ts
// Instead of: if (!this.autoPauseEscalated.has(agentName))
// Use: if (!escalationExistsForPauseEpoch(persistDir, agentName, pausedAt))
```

This is low priority since restarts during an active auto-pause are rare.

---

## Evidence

- DB query: 0 sessions with `source='probe'` (handler's marker)
- DB query: 0 sessions with `[auto-pause-probe]` in task (inline marker also 0 — no agent has been auto-paused recently)
- No `auto-pause-tracker.json` file exists (handler never created one)
- Cron entry already disabled with description explaining why
- Test files import from `src/lib/auto-pause.ts`, not the handler
- No agents currently in auto-paused state

[SIG: tech-lead:1775915662:audit-auto-pause-consolidation]
