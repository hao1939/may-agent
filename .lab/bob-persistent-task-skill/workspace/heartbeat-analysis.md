# Heartbeat System Analysis — may.ts & cron.ts

**Date**: 2026-04-09  
**Source files**: `src/app/may.ts` (lines 1087-1190), `src/app/cron.ts` (full), `src/lib/cron-tool.ts` (full), `agents/may/cron.json` (48 entries)

---

## 1. How Cron Jobs Load, Start, and Dispatch

### Loading (startup — may.ts:1107-1190)

1. `manager.resumeStaleSessions()` — resumes crashed job/call/chat sessions
2. `manager.cleanupZombieSessions()` — archives dirs with terminal status
3. `loadAgentHandlers()` — for each agent's cron.json, finds entries with `handler` field, imports the handler module from `agents/<agent>/handlers/<handler>.ts`, wraps it in a hot-reload closure, calls `cron.registerHandler()`
4. For each agent's Cron instance, `cron.start()` is called which loads entries from cron.json, starts enabled entries

### Starting entries (cron.ts — `startEntry`)

For each enabled entry:
1. `resolveMode()` determines execution type: `heartbeat` | `job-handler` | `job-detached`
2. `computeResumeDelay()` calculates initial delay:
   - If entry has run before: `intervalMs - elapsed` (or 0 if overdue)
   - If never ran + has `offsetMs`: uses offsetMs for deterministic staggering
   - If never ran + no offset: random jitter up to min(intervalMs, 5min)
3. After initial delay, fires immediately then sets `setInterval(fire, intervalMs)`

### Dispatch modes (cron.ts)

| Mode | Condition | What happens |
|------|-----------|-------------|
| **heartbeat** | `type === "heartbeat"` | `manager.run(agent, message, {kind:"job"})` — fresh in-process task session |
| **job-handler** | Has registered JS handler | Runs handler function in-process (no LLM) |
| **job-detached** | Has `agent` but no handler | `spawnDetachedAgent()` — separate OS process |

### Overlap protection

- **Heartbeats**: skips if *any* heartbeat for that agent is already `IN_PROGRESS` (checks `requests` table)
- **JS handlers**: skips if same `artifact` (entry name) is `IN_PROGRESS`
- **Detached**: checks if PID is alive; if dead but request still active, fails orphan then fires

### Circuit breaker (per-agent)

- 3 consecutive errors → circuit trips for 30min
- After 30min, allows one probe; success resets counter
- Also has DB-based `isAgentAutoPaused()` (persistent across restarts)

### Config hot-reload

- `watchFile` (polling every 30s) + explicit content-hash poll every 15s
- Smart reload: only restarts entries whose config actually changed (prevents timer reset bug)

---

## 2. Complete Cron Inventory (48 entries)

### Heartbeats (10 entries)

| # | Name | Agent | Interval | Enabled | Offset | skipIfIdle | initiativeCadence | notifyBrief |
|---|------|-------|----------|---------|--------|-----------|-------------------|-------------|
| 1 | heartbeat | may | 30min | ✅ | 0 | true | — | — |
| 2 | heartbeat-bob | bob | 30min | ✅ | 7min | — | — | ✅ |
| 3 | heartbeat-optimizer | optimizer | 30min | ✅ | 14min | — | — | — |
| 4 | heartbeat-coach | coach | 30min | ✅ | 3min | — | — | ✅ |
| 5 | heartbeat-evaluator | evaluator | 30min | ✅ | 0 | — | — | ✅ |
| 6 | heartbeat-amy | amy | 30min | ❌ | 0 | — | — | — |
| 7 | heartbeat-scout | scout | 30min | ✅ | 21min | — | 8 | ✅ |
| 8 | heartbeat-tech-lead | tech-lead | 30min | ✅ | 10min | true | 6 | ✅ |
| 9 | heartbeat-amy-kimi | amy-kimi | 30min | ❌ | 25min | — | — | ✅ |
| 10 | heartbeat-qa | qa | 30min | ✅ | 28min | true | — | — |

**All heartbeats share the same 30min interval.** Offsets stagger them across the window.

### JS Handler Jobs (22 entries — no LLM cost)

| # | Name | Handler | Interval | Enabled | Offset | Description |
|---|------|---------|----------|---------|--------|-------------|
| 1 | watchdog | watchdog | 10min | ✅ | 0 | Cancel sessions stuck >30min |
| 2 | zombie-cleanup | zombie-cleanup | 60min | ✅ | 0 | Archive orphaned zombie sessions |
| 3 | evaluate-sessions | evaluate-sessions | 30min | ✅ | 6min | Auto-evaluate completed sessions |
| 4 | convention-check | convention-check | 30min | ✅ | 10min | Convention compliance checker |
| 5 | system-status | system-status | 4h | ✅ | 0 | Operational status check |
| 6 | daily-brief | daily-brief | 24h | ✅ | 0 | Daily system metrics |
| 7 | analyze-failures | analyze-failures | 24h | ✅ | 5min | Failure analysis report |
| 8 | coaching-report | coaching-report | 24h | ✅ | 15min | Daily coaching quality report |
| 9 | agents-auto-commit | agents-auto-commit | 10min | ✅ | 0 | Safety-net git auto-commit |
| 10 | lessons-graduation | lessons-graduation | 24h | ✅ | 35min | LESSONS.md health scan |
| 11 | error-log-scanner | error-log-scanner | 4h | ✅ | 8min | Scan ERROR_LOG.jsonl for patterns |
| 12 | audit-requests | audit-requests | 2h | ✅ | 0 | Expire stale requests, cleanup |
| 13 | task-watchdog | task-watchdog | 60min | ✅ | 0 | Nudge agents about stale requests |
| 14 | workspace-compaction | workspace-compaction | 24h | ✅ | 40min | Archive stale workspace files |
| 15 | memory-trimmer | memory-trimmer | 24h | ✅ | 45min | Trim memory files |
| 16 | tool-quality-scan | tool-quality-scan | 4h | ✅ | 11min | Scan evaluations for tool failure patterns |
| 17 | heartbeat-context | heartbeat-context | 30min | ✅ | 1min | Pre-compute context for heartbeats |
| 18 | active-nudge | active-nudge | 5min | ✅ | 0 | Detect loops/stalls in running sessions |
| 19 | daily-digest | daily-digest | 24h | ✅ | 50min | Daily progress digest |
| 20 | tracker-compact | tracker-compact | 4h | ✅ | 2min | Generate compact status index |
| 21 | coaching-feedback | coaching-feedback | 12h | ✅ | 2h | Evaluation→coaching feedback loop |
| 22 | health-trend | health-trend | 7d | ✅ | 3h | Weekly health trend analysis |
| 23 | repo-gate-check | repo-gate-check | 30min | ✅ | 14min | QA commit preflight |
| 24 | research-sync | research-sync | 30min | ✅ | 4min | Sync research artifacts to SQLite |

### Detached / run-agent-task Jobs (LLM cost — 8 entries)

| # | Name | Agent | Handler | Interval | Enabled | Preflight | Description |
|---|------|-------|---------|----------|---------|-----------|-------------|
| 1 | optimize | optimizer | run-agent-task | 24h | ✅ | — | Implements one fix per day |
| 2 | reflect | coach | run-agent-task | 6h | ✅ | new-entries-since | Coach reflects on human interactions |
| 3 | common-sense-verify | coach | run-agent-task | 4h | ✅ | new-entries-since | Verify one behavioral item |
| 4 | common-sense-infra | bob | run-agent-task | 24h | ✅ | — | Review common-sense infra gaps |
| 5 | research-intake | coach | run-agent-task | 24h | ✅ | new-entries-since | Coach reads Scout/Amy research |
| 6 | training-sprint | — | run-workflow | 24h | ✅ | — | Coach gym experiments batch |

### Disabled entries (6)

| # | Name | Type | Agent | Reason |
|---|------|------|-------|--------|
| 1 | heartbeat-amy | heartbeat | amy | (no reason noted) |
| 2 | heartbeat-amy-kimi | heartbeat | amy-kimi | 429 billing error |
| 3 | lesson-consolidation | job | bob | Redundant with lessons-graduation JS handler |
| 4 | evaluate-session-llm | job | evaluator | Redundant with evaluate-sessions JS handler |
| 5 | project-monitor | job | may | (disabled) |
| 6 | exp034-monitor | — | — | Experiment completed |
| 7-12 | consolidate-memory-* | job | various | All 7 agents' memory consolidation disabled |

---

## 3. Dispatch Mechanics — Heartbeat Injection

When `fireHeartbeat()` runs, it builds a rich task message by injecting:
1. **heartbeat.md** — the agent's heartbeat instructions (read from `agents/<agent>/heartbeat.md`)
2. **Pending tasks** — all `CREATED`/`IN_PROGRESS` requests for this agent from the DB, wrapped in `<retrieved_state>` tags
3. **Last interrupted session** — if the agent's previous session was interrupted recently (within 2× interval), injects summary so agent can resume

After heartbeat completes:
- All injected pending request IDs are auto-completed
- If `notifyBrief: true`, sends the agent's last assistant message via notification (Telegram)
- Circuit breaker state is updated (success resets, failure increments)

---

## 4. Key Findings: What Could Be Consolidated or Removed

### Finding 1: `skipIfIdle` and `initiativeCadence` are DEAD CODE

**Severity: High (misleading config)**

These fields are defined in `CronEntry` interface (cron-tool.ts:60,65) and set on 3 heartbeats (may, tech-lead, qa) and 1 scout entry. But **they are never checked in cron.ts**. The `fire()` function in `startEntry()` has no logic that reads `skipIfIdle` or `initiativeCadence`. 

The optimizer's context.md even says: *"DO NOT propose heartbeat-skipping or idle-skip optimizations. We tried this and removed it."* So the implementation was removed but the config fields were left behind.

**Action**: Remove `skipIfIdle` and `initiativeCadence` from the CronEntry type and from cron.json entries to avoid confusion.

### Finding 2: 7 high-frequency JS handlers could fire less often

These 30min-interval JS handlers run as often as heartbeats:

| Handler | Current | Suggested | Rationale |
|---------|---------|-----------|-----------|
| heartbeat-context | 30min | Keep (pre-computes for heartbeats) | Fires 1min before heartbeats, good |
| evaluate-sessions | 30min | 60min | Sessions complete at heartbeat rate; 30min is overkill |
| convention-check | 30min | 60min | Dependent on evaluate-sessions output |
| repo-gate-check | 30min | 60min | Commit rate is low; 30min wasteful |
| research-sync | 30min | 60min | Research artifacts change slowly |

Reducing these to 60min would halve their fire rate (144→72 fires/day) with negligible impact.

### Finding 3: Consolidation candidates — daily batch

Six 24h-interval handlers all run daily and write reports. They could be consolidated into a single "daily-maintenance" handler:

- `daily-brief`
- `daily-digest`
- `analyze-failures`
- `coaching-report`
- `lessons-graduation`
- `workspace-compaction`
- `memory-trimmer`

A single handler running these sequentially would reduce 7 DB request tracking entries per day to 1, and make scheduling simpler. All have unique offsetMs already (suggesting they were designed to run separately), but they share no overlap concerns.

### Finding 4: `active-nudge` at 5min is the highest-frequency job

At 5min intervals, this fires 288 times/day. Since it's a JS handler (no LLM cost), the CPU cost is minimal, but each fire creates a request tracking entry in SQLite. Consider if this could be event-driven rather than polled.

### Finding 5: Watchdog + zombie-cleanup + audit-requests overlap

All three deal with stale/orphaned sessions:
- **watchdog** (10min): Cancel sessions stuck running >30min
- **zombie-cleanup** (60min): Archive orphaned zombie sessions
- **audit-requests** (2h): Expire stale requests, clean up orphans

These could be a single "session-hygiene" handler at 10min with different check cadences internally (cancel stuck: every run, archive zombies: every 6th run, audit requests: every 12th run).

### Finding 6: Startup also does zombie cleanup

`may.ts:1145` calls `manager.cleanupZombieSessions()` at startup, *and* the `zombie-cleanup` cron runs every 60min. The startup cleanup handles the same case. This is fine (belt + suspenders) but worth noting.

### Finding 7: Config file watching is redundant

Two mechanisms watch cron.json:
1. `fs.watchFile()` with 30s polling
2. Explicit content-hash poll every 15s

The comment says "watchFile can be unreliable in containers" — this is true, but both are polling anyway. The 15s poll alone would suffice.

---

## 5. Summary Table — Fire Rates

| Interval | Count (enabled) | Fires/day | LLM cost? |
|----------|----------------|-----------|-----------|
| 5min | 1 | 288 | No (JS) |
| 10min | 2 | 288 | No (JS) |
| 30min | 12 (8 heartbeats + 4 JS) | 576 | Heartbeats: yes |
| 60min | 2 | 48 | No (JS) |
| 2h | 1 | 12 | No (JS) |
| 4h | 5 (4 JS + 1 LLM) | 30 | 1 LLM |
| 6h | 1 | 4 | LLM (with preflight) |
| 12h | 1 | 2 | No (JS) |
| 24h | 8 (5 JS + 3 LLM) | 8 | 3 LLM |
| 7d | 1 | 0.14 | No (JS) |

**Total fires/day: ~1,256** (1,200 JS + ~56 heartbeat/LLM sessions)

### Recommendations (priority order)

1. **Remove dead `skipIfIdle`/`initiativeCadence` fields** — they mislead operators into thinking idle-skip is active
2. **Consolidate watchdog/zombie-cleanup/audit-requests** into a single session-hygiene handler
3. **Reduce 30min JS handlers to 60min** where data changes slowly (evaluate-sessions, convention-check, repo-gate-check, research-sync)
4. **Consider event-driven active-nudge** instead of 5min polling
5. **Consolidate 7 daily handlers** into a single daily-maintenance runner
