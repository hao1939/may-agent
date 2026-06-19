---
id: KE-2041
title: "AKS Cliff at 24h — No Self-Recovery, Runtime Restart Required"
date: 2026-06-19
author: arc
status: active
tags: [aks-explorer, throughput, planner, runtime, handler, deadlock]
related: [KE-2040, KE-2039, KE-2038, KE-2037, KE-2036, KE-2033]
last_verified: 2026-06-19T01:05Z
---

<ai_context>
summary: The AKS throughput cliff has reached 24 hours (Jun 18 ~01:05Z start of event accumulation → Jun 19 01:05Z). The planner handler last fired at 10:19:48Z Jun 18 (14.9h ago). 788 project.owner.requested events sit pending with handled_by=null — zero have been processed. No handler.started, handler.completed, or handler.skipped events reference the planner in this window. KE-2040's F1 (in-memory desync requiring restart) is now the only surviving hypothesis. KE-2038's F1 (self-recovery within 12h) is definitively falsified. The 3-day periodicity noted in KE-2037 predicted recovery within one business day — at 24h, this cliff exceeds all previously observed recovery windows. Two parallel issues need human attention: (1) runtime restart to clear the in-memory subscription desync, and (2) may's separate P1 escalation for event.pair-orphan-count which ALSO requires a server restart. A single restart would likely resolve both.
triggers: heartbeat health check, continuation of KE-2040
falsifiers:
  - F1: "If a runtime restart occurs and the planner immediately resumes (first handler.started for aks-rp-e2e-project-planner within 10 min of restart), this confirms the in-memory subscription desync hypothesis." — Observable post-restart.
  - F2: "If a runtime restart occurs but the planner does NOT resume, the cause is in persistent state (DB, filesystem) not in-memory — would require code investigation." — Would escalate to dev.
  - F3: "If the cliff self-resolves before any human intervention, the cause may be a long-period timer or garbage collection event clearing stale state." — Monitoring continues.
</ai_context>

## Observation

### 24-Hour Cliff Summary

| Metric | Value |
|--------|-------|
| Cliff onset (first pending event) | ~01:05Z Jun 18 |
| Planner last fired | 10:19:48Z Jun 18 (14.9h ago) |
| Current time | 01:05Z Jun 19 |
| Total cliff duration | **24.0 hours** |
| Pending project.owner.requested events | **788** (all unprocessed) |
| Event accumulation rate | ~33/hour |
| Planner handler events in window | **0** (no started, completed, or skipped) |
| AKS sessions still running (metric-alert-triage) | Yes, 2 in last 2h |
| AKS task tree state | Structurally frozen (2 stale active, 73 blocked, 4 backlog) |

### Falsification Status from Prior KEs

| KE | Falsifier | Status |
|----|-----------|--------|
| KE-2038 F1 | Recovery within 12h | **FALSIFIED** at 14.3h (KE-2040) |
| KE-2037 | 3-day periodicity predicts recovery within 1 business day | **UNDER STRESS** — 24h exceeds all prior observed cliffs |
| KE-2040 F1 | In-memory desync → restart fixes | **SURVIVING** — only remaining hypothesis |
| KE-2040 F2 | Git log shows code change disabling planner | Checked: no change |
| KE-2040 F3 | isRunning check skips planner | Reviewed: only applies to heartbeats |

### System State at 24h

1. **Watchdog treadmill**: 788 events × handler overhead = ~1500+ wasted handler invocations
2. **Handler fire rate**: 97/hr — inflated by watchdog producing events nobody consumes
3. **DB size**: 1627 MB (stable — cliff suppresses session-driven growth)
4. **AKS sessions**: Only metric-alert-triage sessions fire (via separate handler path). No planner → no task assignment → no worker sessions.
5. **Separate restart blocker**: May has escalated event.pair-orphan-count (P1, 5th triage) also requiring a server restart.

### What a Restart Would Fix (Both Issues)

A single runtime restart would:
1. Rebuild `eventSubscriptions` map → planner resumes processing `project.owner.requested` events
2. Deploy the already-patched `db-writer.ts` → 45-min pair TTL + orphan closure fixes the pair orphan metric
3. Allow pending events to drain (788 events at normal processing rate ≈ 2-3h)

## Implication

1. **The system lacks automatic recovery for subscription desync.** The daemon heartbeat fires every ~60s (evidenced by `runtime.daemon.heartbeat` events), but doesn't verify handler subscription integrity. A health check that periodically calls `buildEventSubscriptions()` or validates the Map against the declared `on:[]` arrays would prevent multi-day cliffs.

2. **Watchdog without circuit breaker is pure cost.** 788 events over 24h with zero processing = structural waste. The watchdog should implement exponential backoff when its events go unprocessed for >1h.

3. **Two P1 escalations converge on one action.** Both the planner cliff and the pair-orphan metric resolve with a single restart. This convergence should accelerate human response.

4. **Task tree reaper still needed.** Even after restart, the 2 stale active tasks with phantom session IDs (`s_task_...`) will re-trigger the watchdog immediately. A tree sanitizer that moves tasks with dead sessions to backlog is needed to prevent instant re-cliff after recovery.
