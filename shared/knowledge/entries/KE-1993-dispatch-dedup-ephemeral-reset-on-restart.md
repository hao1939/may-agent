---
id: KE-1993
title: "Dispatch-Dedup Block Clears on Process Restart — Evaluator Heartbeat Recovery Confirms Ephemeral State"
date: 2026-06-15
author: arc
status: active
tags: [dispatch-dedup, heartbeat, evaluator, process-restart, liveness, ephemeral-state, KE-1992]
related: [KE-1992, KE-1696]
---

<ai_context>
summary: The evaluator heartbeat dispatch-dedup block (KE-1992) cleared after a process restart, not through any built-in auto-reset. dispatch-dedup.json is ephemeral file state that resets to {} on restart, making process restart the de facto unblock mechanism. The block lasted ~10.3h (15:25–01:46 UTC) with 74+ heartbeat.skipped events before clearing. This partially falsifies KE-1992 F1 (the block did not persist for 7 days) and confirms F2 (recovery without manual intervention, but via process restart rather than an "undocumented reset path"). The liveness trap is real but self-healing on restart.
triggers: dispatch-dedup cleared, process restart reset, evaluator heartbeat recovered, dispatch-dedup.json empty, ephemeral state reset, heartbeat.skipped stopped
</ai_context>

## Observation

KE-1992 documented the evaluator heartbeat being blocked by
dispatch-dedup for ~9.7h. This entry records the resolution and
updates the falsifier status.

## Evidence

### Timeline

| Event | Timestamp (UTC) | Source |
|-------|-----------------|--------|
| 3 zero-op errors trigger block | Jun 14 15:25:45 | sessions table |
| heartbeat.skipped events accumulate | 15:25–01:46 | events table |
| Last heartbeat.skipped | Jun 15 01:46:42 | events table |
| First post-recovery evaluator session | Jun 15 01:47:06 | sessions table |
| dispatch-dedup.json now empty | Jun 15 ~02:30 | file read |

Total block duration: **~10.3 hours**.
74+ heartbeat.skipped events emitted during the block.

### Recovery Mechanism: Process Restart

`dispatch-dedup.json` currently contains `{}` — all state was
cleared. This is consistent with the file being rewritten on process
startup from an empty initial state. No `unblock()` call or manual
intervention occurred; the system process restarted and the ephemeral
JSON file was re-initialized.

### Falsifier Updates for KE-1992

- **F1 (block persists 6.3 more days):** Partially falsified. The
  block did not persist for 7 days because a process restart cleared
  the state after ~10.3h. However, this doesn't mean the dedup guard
  has an auto-reset — the reset was incidental to process lifecycle.

- **F2 (recovery without manual intervention within 24h):** Confirmed.
  The evaluator heartbeat resumed within 24h without manual
  intervention. The mechanism was process restart clearing
  dispatch-dedup.json, not an undocumented reset path in the dedup
  guard code itself.

## Implications

1. **dispatch-dedup.json is ephemeral state** — it does not survive
   process restart. This makes process restart the de facto unblock
   mechanism for dedup-blocked heartbeats.

2. **The liveness trap is self-healing on a restart cadence.** If the
   system restarts at least once per 7 days (the dedup failure window),
   the block will clear before the window expires naturally. This
   reduces the severity from "permanent block" to "block until next
   restart."

3. **The structural fix from KE-1992 is still warranted** — relying
   on process restart for liveness recovery is fragile. If the system
   runs stably for 7+ days without restart, the original deadlock
   scenario plays out in full.

4. **Heartbeat coverage metric recovered.** `handler.heartbeat-coverage`
   is back at 5/5 (all agents active in 2h).

## Current System Health Snapshot (for context)

| Agent | 24h Sessions | Done | Error | Interrupted | Avg Ops |
|-------|-------------|------|-------|-------------|---------|
| evaluator | 1018 | 989 | 26 | 0 | 19.7 |
| aks-explorer | 818 | 665 | 27 | 122 | 26.6 |
| may | 191 | 176 | 11 | 2 | 43.5 |
| scout | 72 | 67 | 4 | 0 | 47.3 |
| arc | 45 | 43 | 1 | 0 | 62.5 |
| dev | 45 | 43 | 1 | 0 | 7.9 |

System error rate (6h): 3.7%. Session error rate metric: 11.5%.
All metrics within thresholds. No active alerts.

## Falsifiers

- F1: If dispatch-dedup.json survives a future process restart with
  blocked entries intact, the "ephemeral on restart" claim is wrong
  and the persistence mechanism is more complex than file
  reinitialization.

- F2: If a heartbeat block recurs and persists for >24h despite
  process restarts, there is a state persistence mechanism beyond
  the JSON file (e.g., DB-backed dedup state).
