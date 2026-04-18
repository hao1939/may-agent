# Audit: auto-pause.ts Architecture Review

**Lens A** — 2026-04-13  
**Scope**: `src/lib/auto-pause.ts` + `src/app/cron.ts` integration + recovery path  
**Tests**: `test/auto-pause.test.ts`, `test/auto-pause-recovery.test.ts`

---

## 1. How does auto-pause trigger?

**Mechanism**: `getAutoPauseState()` queries the `sessions` table for the last N completed sessions (where N = `threshold`, default 3). If ALL are `status = 'error'`, the agent enters `auto-paused` state.

**Key details**:
- State is **fully derived from DB** — no persistent flag, survives restarts.
- Probe sessions are filtered out using `[auto-pause-probe]` marker in the task text.
- `pausedAt` is set to the `startedAt` of the Nth non-probe error session (the trigger session).
- Queries `LIMIT max(threshold, 20)` — the 20 is headroom for finding probe sessions mixed in.

**Verdict**: ✅ Sound. Stateless derivation from DB is a good pattern. No file-based state to corrupt.

---

## 2. How does recovery work?

**State machine**: `RUNNING → AUTO-PAUSED → PROBING → RUNNING`

**Probe scheduling**:
- First probe: 1h after pause.
- Backoff: `initialDelay × 2^failCount`, capped at 8h.
- TTL: After 24h total pause time, force a probe regardless.

**Recovery detection**: When `getAutoPauseState()` returns `"running"` for an agent that was previously in `autoPauseActive` map, cron fires `createRecoveryNotification()`.

**⚠️ Finding — Severity: MEDIUM — In-memory recovery tracking lost on restart**  
The `autoPauseActive` and `autoPauseEscalated` maps are **in-memory only**. If the cron process restarts while an agent is auto-paused:
- The recovery notification will **never fire** (because `autoPauseActive` is empty after restart).
- The escalation will fire **again** (because `autoPauseEscalated` is empty, so it re-creates the request).

This contradicts the design comment "Stateless: all state derived from sessions + requests tables (survives restarts)". The core state machine IS stateless, but the notification layer is not.

**Impact**: Duplicate escalation requests on restart; missing recovery notifications. Low operational impact since these are informational messages, but it violates the design intent.

---

## 3. Is the cron integration sound?

**Wiring in `cron.ts`**: The `fire()` function inside `startEntry()` handles auto-pause inline:

1. Check `isAgentHeartbeatRunning()` — overlap protection ✅
2. Call `getAutoPauseState()` — derive pause state ✅
3. If `auto-paused` + `probeDue` → fire probe heartbeat ✅
4. If `auto-paused` + not due → skip + log + escalate on first detection ✅
5. If `probing` → skip (don't fire duplicate probes) ✅
6. If `running` + was in `autoPauseActive` → recovery notification ✅

**Non-heartbeat jobs** also get auto-pause protection (line ~520 in cron.ts) — any entry with `entry.agent` is checked. ✅

**Verdict**: ✅ Integration is thorough. Both heartbeat and detached job modes are covered.

---

## 4. Silent failure modes and edge cases

### 4a. ⚠️ Severity: LOW — `shouldFireProbe` and `isAgentAutoPaused` are dead imports
Both are imported in `cron.ts` (lines 27, 29) but **never called**. Cron.ts uses `getAutoPauseState()` directly and implements the probe/pause logic inline. These are dead code in the import.

`isAgentAutoPaused` is also dead in `auto-pause.ts` itself — it wraps `getAutoPauseState` "for backward compatibility" but has zero callers outside of tests.

### 4b. ⚠️ Severity: LOW — Fail-open on DB error
Every function in `auto-pause.ts` catches all exceptions and returns "running" (fail-open). This is the right default for availability, but a persistent DB corruption would silently disable auto-pause with no log output. The catch blocks swallow all errors.

### 4c. ⚠️ Severity: LOW — Probe marker in task text is fragile
Probe sessions are identified by `task.includes("[auto-pause-probe]")`. If the task text gets truncated or reformatted anywhere in the pipeline, the marker is lost and the session won't be recognized as a probe. Currently `buildProbeTaskMessage` puts the marker as a prefix, which is the safest position, so this is unlikely but worth noting.

### 4d. ✅ No race condition in probe firing
Cron checks for `status = 'running'` probe sessions in the DB before firing a new probe. This prevents duplicate probes even if the cron timer fires faster than expected.

### 4e. ✅ TTL forced probe is a good safety net
After 24h, a probe fires regardless of backoff. This prevents an agent from being permanently stuck in auto-pause.

---

## 5. Dead weight / unnecessary complexity

| Item | Status | Notes |
|------|--------|-------|
| `shouldFireProbe()` | **Dead code** | Never called outside tests. Cron inlines the logic. |
| `isAgentAutoPaused()` | **Dead code** | Legacy wrapper, no callers in production code. |
| `parseAutoPauseConfig()` | ✅ Used | Allows per-entry config override via `handlerConfig.autoPause`. |
| `parseDurationMs()` helper | ✅ Clean | Handles "1h", "30m" etc — useful for config. |
| `formatDuration()` helper | ✅ Used | For human-readable escalation messages. |
| `getLastErrors()` | ✅ Used | For escalation context. |
| `createPauseEscalation()` | ✅ Used | Sends tracked request to May. |
| `createRecoveryNotification()` | ✅ Used | Informs May of recovery. |

**Complexity assessment**: The module is ~300 lines for a 3-state machine with backoff, TTL, escalation, and recovery. This is proportionate to the feature scope. Not over-engineered.

---

## Summary

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | In-memory `autoPauseActive`/`autoPauseEscalated` maps lost on restart — recovery notifications missed, escalations duplicated | MEDIUM | Could persist to DB or derive from requests table |
| 2 | `shouldFireProbe` and `isAgentAutoPaused` are dead imports in cron.ts | LOW | Remove unused imports |
| 3 | Fail-open catch blocks swallow errors silently | LOW | Add `onError?.()` logging in catch blocks |
| 4 | Probe marker in task text is string-matching fragile | LOW | Acceptable risk — marker is prefix-positioned |

**Overall**: Architecture is solid. The state machine design (stateless derivation from DB) is the right call. The only meaningful gap is the in-memory notification tracking (#1), which breaks the "survives restarts" guarantee for the notification layer. The dead code (#2) is cleanup work, not a bug.
