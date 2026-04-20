# Design: Auto-Pause Circuit Breaker Recovery

**Date**: 2026-04-09
**Status**: Proposed
**Authors**: Bob (design), tech-lead (root cause analysis), May (requirements)
**Priority**: P1

## Problem Statement

The `may-agent` binary includes a circuit breaker (`isAgentAutoPaused()`) that halts heartbeats after 3 consecutive session errors. This is a sound safety mechanism — it prevents error-spamming when an agent or model is broken. However, it has **no recovery path**: once paused, an agent stays paused indefinitely because no new sessions are created to break the error streak.

This caused the **17-day Optimizer + QA outage** (March 23 – April 9, 2026). A model name resolution change caused HTTP 400 errors. The model name issue was temporary, but Optimizer and QA had already tripped the auto-pause threshold. With no probe or decay mechanism, they remained paused for 17 days until manual intervention.

See: `agents/tech-lead/workspace/fix-optimizer-qa-outage.md` for full root cause analysis.

## Proposed Mechanism

The recovery system adds three capabilities to the existing auto-pause:

1. **Probe timer with exponential backoff** — periodically test whether the failure has resolved
2. **TTL/decay** — auto-pause expires after a maximum duration regardless of probe results
3. **Escalation** — create a tracked request to May when auto-pause activates

### State Machine

```
                         3 consecutive errors
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              │
┌──────────────────────┐                ┌─────────┴──────────┐
│       RUNNING        │                │     AUTO-PAUSED    │
│  (normal heartbeat)  │◄───resume──────│  (heartbeats off)  │
│                      │                │                    │
└──────────────────────┘                └─────────┬──────────┘
        ▲                                         │
        │                                  probe timer fires
        │                                         │
        │                                         ▼
        │                               ┌────────────────────┐
        │          probe succeeds       │      PROBING       │
        └───────────────────────────────│  (single session)  │
                                        └─────────┬──────────┘
                                                  │
                                           probe fails
                                                  │
                                                  ▼
                                        ┌────────────────────┐
                                        │   AUTO-PAUSED      │
                                        │ (backoff doubled)  │
                                        └────────────────────┘

TTL exceeded at any point in AUTO-PAUSED → force transition to PROBING
```

### State Definitions

| State | Heartbeats | Probes | Entry Condition |
|-------|-----------|--------|-----------------|
| **RUNNING** | Active (per cron schedule) | N/A | Default; or probe session succeeds |
| **AUTO-PAUSED** | Suspended | Scheduled via probe timer | 3 consecutive session errors (`status = 'error'`) |
| **PROBING** | Suspended | One session running | Probe timer fires or TTL forces probe |

### Transitions

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| RUNNING → AUTO-PAUSED | 3 consecutive errors | Emit `agent:auto-paused` event; create escalation request to May; log pause reason; record `pausedAt` timestamp |
| AUTO-PAUSED → PROBING | Probe timer fires | Start single heartbeat session with `probe: true` flag |
| AUTO-PAUSED → PROBING | TTL exceeded | Force probe regardless of backoff schedule |
| PROBING → RUNNING | Probe session succeeds (`status != 'error'`) | Clear pause state; emit `agent:resumed` event; log recovery |
| PROBING → AUTO-PAUSED | Probe session errors | Double backoff interval (capped at `maxProbeInterval`); increment `probeFailCount` |

## Probe Timer with Exponential Backoff

The probe schedule uses exponential backoff to avoid spamming sessions when the underlying issue persists (e.g., model still unavailable, persistent config error).

### Schedule

```
Probe 1:  initialProbeDelay     (default: 1h after pause)
Probe 2:  initialProbeDelay × 2  (2h)
Probe 3:  initialProbeDelay × 4  (4h)
Probe 4:  initialProbeDelay × 8  (8h) — capped at maxProbeInterval
Probe 5+: maxProbeInterval       (8h)
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `pauseThreshold` | `3` | Consecutive errors to trigger pause (existing) |
| `initialProbeDelay` | `1h` | Time before first probe after pause |
| `probeBackoffMultiplier` | `2` | Multiplier for each failed probe |
| `maxProbeInterval` | `8h` | Cap on probe interval |
| `pauseTTL` | `24h` | Maximum pause duration before forced probe + resume |
| `escalationAgent` | `"may"` | Agent to receive escalation request |

### Why These Defaults

- **1h initial probe**: Most transient failures (model availability, API rate limits, deploy glitches) resolve within an hour. A 1h delay gives the system time to stabilize without leaving agents paused for days.
- **2× backoff**: Standard exponential backoff. Aggressive enough to converge quickly, conservative enough to avoid wasting sessions.
- **8h cap**: Ensures at least 3 probes per day even for persistent failures. Provides visibility without excessive cost.
- **24h TTL**: Hard upper bound. No agent should ever be paused for more than 24 hours without at least attempting recovery. The 17-day outage would have been limited to ≤24h.

## TTL / Decay

The `pauseTTL` provides a hard upper bound on pause duration:

```
if (now - pausedAt > pauseTTL) {
  // Force a probe regardless of backoff schedule
  // If probe succeeds: resume
  // If probe fails: reset pausedAt to now, restart TTL countdown
  //   (this prevents infinite pause, but doesn't spam — at most 1 probe per TTL)
}
```

**Important**: TTL expiry does NOT automatically resume the agent. It forces a probe. If the probe fails, the TTL resets. This prevents an agent from resuming into a still-broken state and generating error noise.

## Escalation

When auto-pause activates, the system creates a tracked request:

```typescript
createRequest({
  fromEntity: "cron",
  toAgent: config.escalationAgent,  // default: "may"
  type: "auto-pause-escalation",
  priority: "P1",
  message: `Agent "${agentName}" auto-paused after ${pauseThreshold} consecutive errors. ` +
           `Last error: ${lastErrorSummary}. ` +
           `Probe scheduled in ${initialProbeDelay}. TTL: ${pauseTTL}.`,
  artifact: `auto-pause:${agentName}`,
  context: JSON.stringify({
    agent: agentName,
    pausedAt: new Date().toISOString(),
    lastErrors: recentErrors,  // last N error summaries
    probeSchedule: { initial: initialProbeDelay, backoff: probeBackoffMultiplier, max: maxProbeInterval },
    ttl: pauseTTL
  })
});
```

When a probe succeeds and the agent resumes, a follow-up message is sent:

```typescript
createRequest({
  fromEntity: "cron",
  toAgent: config.escalationAgent,
  type: "auto-pause-recovery",
  priority: "P2",
  message: `Agent "${agentName}" recovered from auto-pause after ${probeCount} probes ` +
           `(${pauseDuration} total pause time).`,
  artifact: `auto-pause-recovery:${agentName}`
});
```

This ensures May (or a human reading May's queue) is always aware of pause events and can investigate root causes even after auto-recovery.

## Edge Cases

### 1. Probe session itself errors

The probe session is a normal heartbeat session. If it errors:
- Increment `probeFailCount`
- Double the backoff interval (up to cap)
- Return to AUTO-PAUSED state
- The system does NOT count the probe failure as a "new" consecutive error — the pause state is already established

### 2. skipIfIdle agents (e.g., QA)

QA has `skipIfIdle: true` — it only fires heartbeats when there are pending requests. This creates a compounding problem: even if auto-pause is cleared, QA won't fire until someone sends it work.

**Solution**: Probe sessions bypass `skipIfIdle`. When the probe timer fires for a `skipIfIdle` agent:
- Run the probe session regardless of idle state
- Use the agent's standard heartbeat message (so the session is a real health check)
- If the probe succeeds, clear auto-pause AND the agent resumes normal `skipIfIdle` behavior

Without this, a `skipIfIdle` agent that gets auto-paused can be stuck indefinitely even after the underlying issue resolves — exactly what happened to QA.

### 3. Agent with persistent configuration error

If the underlying issue is permanent (e.g., agent.json has an invalid model, agent's SOUL.md is missing), probes will keep failing. The backoff schedule limits this to at most 3 probes/day after reaching the cap. The escalation request ensures a human is notified.

**Cost bound**: At `maxProbeInterval = 8h`, a permanently broken agent generates at most 3 failed sessions per day. At ~$0.05-0.10 per session, this is $0.15-0.30/day — negligible and well worth the automatic recovery when the issue IS transient.

### 4. Multiple agents pause simultaneously

Each agent has independent pause state. If a systemic failure (like the model name resolution change) pauses multiple agents, they each probe independently. Their probes will naturally stagger due to different `pausedAt` timestamps.

No special coordination is needed — the escalation requests to May will make the systemic pattern visible ("5 agents paused within 10 minutes → likely systemic issue").

### 5. Race condition: probe overlaps with manual intervention

If someone manually creates a successful session for a paused agent (as tech-lead did to fix the outage), the next `isAgentAutoPaused()` check will see a non-error session in the recent history and return `false`. The pause state is effectively cleared.

The probe timer should check `isAgentAutoPaused()` before firing. If the agent is no longer paused (due to manual fix), skip the probe.

### 6. Probe during a deploy/restart

If the cron process restarts while a probe is in-flight, the orphan detection logic from `cron-sqlite.md` handles this — the probe session will be marked FAILED on next startup, and the probe timer resumes with the next backoff interval.

## Configuration Surface

All parameters are per-agent, set in the agent's cron configuration with sensible defaults:

```jsonc
// In cron.json, per heartbeat entry:
{
  "name": "heartbeat-optimizer",
  "agent": "optimizer",
  "interval": "24h",
  "handler": "run-agent-task",
  "autoPause": {
    "enabled": true,              // default: true (existing behavior)
    "threshold": 3,               // default: 3 (existing)
    "initialProbeDelay": "1h",    // default: "1h"
    "probeBackoffMultiplier": 2,  // default: 2
    "maxProbeInterval": "8h",     // default: "8h"
    "pauseTTL": "24h",            // default: "24h"
    "escalationAgent": "may"      // default: "may"
  }
}
```

**Override examples**:
- **High-frequency agent (bob, 10min heartbeat)**: `initialProbeDelay: "30m"` — probe sooner since the feedback loop is faster
- **Low-frequency agent (optimizer, 24h)**: Default 1h is fine — the agent only runs once a day anyway
- **Critical agent**: `pauseTTL: "4h"` — shorter TTL for agents whose downtime is high-impact
- **Agent with known flaky model**: `threshold: 5, maxProbeInterval: "4h"` — higher threshold to avoid false pauses, more frequent probes when paused

## Implementation Notes

### Where This Hooks In

The auto-pause check currently lives in the cron cycle's heartbeat-precheck phase:

```
cron timer fires → heartbeat-precheck → isAgentAutoPaused() → if true, skip
```

The recovery mechanism adds:

```
cron timer fires for probe → check if paused → if paused AND probe timer due:
  → bypass heartbeat-precheck
  → run single heartbeat session
  → on completion: check session status
    → if success: clear pause state, emit recovery event
    → if error: update backoff, re-arm probe timer
```

### Implementation as a cron handler (not a guard)

Per `code-vs-data-decisions.md`, this is NOT a judgment intervention — it's a mechanical, deterministic state machine. No regexes, no heuristics. The logic is:
- Count errors: `SELECT status FROM sessions WHERE agent = ? ORDER BY startedAt DESC LIMIT ?`
- Track time: `pausedAt` timestamp vs `pauseTTL`
- Schedule probes: deterministic exponential backoff

This is the same class as the existing `watchdog.ts` and `heartbeat-precheck.ts` handlers — infrastructure logic, not behavioral constraint. It belongs in code.

### Persistence

Pause state needs to survive process restarts. Two options:

**Option A: Derive from session table (stateless — preferred)**
The current `isAgentAutoPaused()` already derives pause state from the sessions table. Extend this:
- `pausedAt` = timestamp of the Nth consecutive error session
- `probeFailCount` = count consecutive probe failures after `pausedAt`
- `lastProbeAt` = timestamp of most recent probe session

All of these can be derived from the sessions table if probe sessions are tagged (e.g., `context: { probe: true }`). No new tables needed.

**Option B: Explicit state table**
Add a `pause_state` column or separate table. More explicit but adds schema.

**Recommendation**: Option A (stateless derivation). It follows the existing pattern from `cron-sqlite.md` of reusing the sessions/requests tables rather than adding new schema. Tag probe sessions in their context metadata.

### Probe session tagging

Probe sessions should be distinguishable from regular sessions:
```typescript
// When creating a probe session:
context: {
  type: "heartbeat",
  probe: true,
  probeNumber: n,
  pausedSince: pausedAt
}
```

This allows:
- The state machine to identify probe sessions when reconstructing state
- May's escalation handler to see probe history
- Metrics/dashboards to track probe success rates

## Connection to Knowledge Base

### KE-007 (Structural Enforcement)
The auto-pause is itself a structural intervention — it enforces a mechanical circuit breaker rather than relying on agents to "notice" they're broken. The recovery mechanism extends this structural approach: probes are mechanical health checks, not judgment calls. This aligns with KE-007's finding that structural interventions are the only reliable behavioral interventions.

### CR#259 (MAS Circuit Breaker Architecture)
Our deep-dive `cr259-mas-circuit-breaker-architecture.md` synthesized the microservices circuit breaker pattern (CLOSED → OPEN → HALF-OPEN) into a five-state MAS model. Our auto-pause recovery maps directly:

| MAS Circuit Breaker (CR#259) | Auto-Pause Recovery |
|------------------------------|-------------------|
| CLOSED (full comms) | RUNNING (normal heartbeat) |
| OPEN (isolated) | AUTO-PAUSED (heartbeats off) |
| HALF-OPEN (test message) | PROBING (single probe session) |
| DEGRADED (filtered) | Not needed — our agents are independent, not communicating peers |
| QUARANTINE (removed) | Not needed — escalation to May serves this function |

The key CR#259 insight applies: "continuing to send requests to a failing service makes things worse." Auto-pause correctly stops heartbeats. The recovery mechanism adds the HALF-OPEN probe that microservices circuit breakers have always had — the piece we were missing.

### Decision Topology
This design follows the `code-vs-data-decisions.md` decision tree:
- ✅ Permanent and universal (auto-pause recovery is always needed)
- ✅ Not environment-dependent (works regardless of model, agent, config)
- ✅ Not a judgment intervention (purely mechanical state machine)
- ✅ Deterministic logic (count errors, check timestamps, apply backoff formula)
→ **Code is the correct mechanism** (same tier as watchdog, heartbeat-precheck)

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Pause trigger | 3 consecutive errors | Same (configurable) |
| Recovery | None (manual only) | Exponential-backoff probe timer + TTL |
| Max downtime | Unbounded (17 days observed) | ≤ `pauseTTL` (default 24h) |
| Visibility | None (silent pause) | Escalation request to May on pause + recovery |
| skipIfIdle agents | Double-stuck (pause + no triggers) | Probes bypass skipIfIdle |
| Cost of persistent failure | $0 (but agent is dead) | ≤ $0.30/day (3 probes) |
| Restart resilience | Pause state survives (session-derived) | Probe state also survives (session-derived) |
