# Cron Architecture Audit — Complexity & Cost Analysis

**Date:** 2026-04-11  
**Lens:** B (Complexity / Layer Count)  
**Status:** Audit complete, findings ready for action

---

## Executive Summary

The cron subsystem has grown into the **most complex single component** in the codebase. What should be a simple "run things on timers" system has accumulated:

- **959-line** `src/app/cron.ts` class doing 6+ separate concerns
- **392-line** `src/lib/auto-pause.ts` library duplicated by a **523-line handler** that has never fired
- **30 handler files** totaling 9,503 lines under `agents/may/handlers/`
- **41 cron entries** in a single `agents/may/cron.json` (despite design claiming "per-agent")
- **~28,000 ops/week** just for heartbeats across 8 agents

The system works but carries significant dead code and architectural debt.

---

## Finding 1: DEAD CODE — Dual Auto-Pause Systems

**Severity: High (complexity) / Medium (cost)**

Two complete, independent auto-pause implementations exist:

| System | Location | Lines | Used? |
|--------|----------|-------|-------|
| Inline (in cron.ts) | `src/lib/auto-pause.ts` + `src/app/cron.ts:420-510` | ~480 total | ✅ Yes — handles all probe/escalation |
| Handler | `agents/may/handlers/auto-pause-recovery.ts` | 523 | ❌ **Never fired a probe** |

Evidence: DB query for `source='probe'` or task containing `[probe]` or `[auto-pause-probe]` returns **zero rows**. The inline system in cron.ts handles everything. The handler duplicates the entire state machine (pause detection, backoff calculation, escalation, recovery notification) but runs on a *separate* schedule.

**Both systems use different probe markers** — inline uses `[auto-pause-probe]` in task text, the handler uses `source='probe'` on the session. They would confuse each other if both ever ran.

**Action:** Delete `agents/may/handlers/auto-pause-recovery.ts` and its cron entry. The inline system is battle-tested.

---

## Finding 2: cron.ts Does Too Many Things (959 lines)

`src/app/cron.ts` is a single class handling:

1. **Timer scheduling** — setInterval/setTimeout with resume-delay calculation
2. **Auto-pause state machine** — pause detection, probe firing, escalation, recovery
3. **Heartbeat message injection** — pending tasks from DB, interrupted session info, heartbeat.md content
4. **Request tracking** — creating/updating request records for every fire
5. **Config watching** — file watcher on cron.json with hot-reload
6. **Detached process management** — PID tracking, orphan cleanup

The heartbeat injection alone (`fireHeartbeat` method) is ~150 lines of DB queries and string assembly. This belongs in its own module.

**Action:** Extract to focused modules:
- `heartbeat-injector.ts` — message assembly with pending tasks, interrupted session, context files
- Keep auto-pause inline (it's the working one) but simplify after removing the handler duplicate
- This would cut cron.ts to ~500 lines with clear single-purpose methods

---

## Finding 3: "Per-Agent Cron" Design Fiction

The `cron-tool.ts` (251 lines) advertises itself as:
> "Agents use this to manage their own scheduled jobs. Each agent has its own cron.json."

Reality: **Only `agents/may/cron.json` exists.** No other agent has a cron.json. The cron tool allows agents to CRUD entries, but:
- Only May has the `cron` tool preset
- All 41 entries (for all agents) live in May's single cron.json
- The agent-loader creates a `Cron` instance per agent that has "cron" in their tool presets, but in practice only May does

This isn't necessarily wrong — centralized scheduling has benefits — but the code/docs pretend it's distributed when it's not. The cron-tool CRUD operations let agents modify May's cron.json, which is a confusing indirection.

**Action:** Update documentation to match reality. Consider whether the cron-tool CRUD abstraction adds value vs. direct file editing.

---

## Finding 4: Heartbeat Cost — 28K ops/week

7-day heartbeat data across all agents:

| Agent | Sessions | Avg Ops | Total Ops | Errors |
|-------|----------|---------|-----------|--------|
| tech-lead | 236 | 19.6 | 4,636 | 7 |
| may | 264 | 17.3 | 4,579 | 3 |
| coach | 248 | 16.9 | 4,198 | 2 |
| bob | 248 | 16.9 | 4,189 | 6 |
| scout | 240 | 16.6 | 3,980 | 6 |
| optimizer | 247 | 10.6 | 2,607 | 9 |
| qa | 252 | 7.9 | 1,990 | 1 |
| evaluator | 244 | 6.0 | 1,458 | 0 |
| amy-kimi | 91 | 10.1 | 915 | 36 |

**~28,500 heartbeat ops/week.** Each op = 1 LLM turn. This is the cost of having 8+ agents with 30-minute heartbeat intervals.

The heartbeats themselves serve a real purpose (check pending tasks, do work). But:
- **evaluator** averages 6 ops per heartbeat — often finding nothing to do
- **qa** averages 7.9 ops — also frequently idle
- **amy-kimi** has a 40% error rate (36 of 91 sessions)

**Action:** Consider conditional heartbeats (skip if no pending tasks/events since last heartbeat) or longer intervals for low-activity agents. The preflight check mechanism already exists but isn't used for heartbeats.

---

## Finding 5: Handler Sprawl — 30 Files, 9,503 Lines

Handler files under `agents/may/handlers/`:

| Size | Count | Examples |
|------|-------|---------|
| >500 lines | 2 | convention-check (1,078), agents-auto-commit (709) |
| 300-500 lines | 9 | auto-pause-recovery (523), analyze-failures (509), tool-quality-scan (426) |
| 100-300 lines | 15 | Various operational handlers |
| <100 lines | 4 | zombie-cleanup (23), research-sync (62), watchdog (129) |

Each handler gets a `HandlerContext` with access to the full runtime (manager, DB, emit, notify, trackRequest, evaluate). This is a powerful but heavy abstraction.

**Key concern:** Many handlers exist as JS because they run DB queries or file checks that don't need LLM reasoning. This is correct architecture. But some (like auto-pause-recovery) duplicate logic that already exists elsewhere.

**Action:** Audit for handlers that duplicate core logic. The dead auto-pause-recovery handler is the most obvious, but check if others overlap.

---

## Finding 6: Preflight Checks — Underused Cost Control

Only **3 of 41** cron entries use preflight checks, despite preflights being the primary mechanism to skip unnecessary LLM sessions. The `run-agent-task.ts` handler supports two types:
- `file-has-content` — skip if a trigger file is empty
- `new-entries-since` — skip if no new data since last run

The 32 job entries (non-heartbeat) are the prime candidates for preflights. Without them, every job fires on schedule regardless of whether there's work to do.

**Action:** Review the 32 job entries and add preflight checks where applicable. Even simple checks ("has the input file changed?") can save significant LLM cost.

---

## Recommended Actions (Priority Order)

### P0: Delete Dead Code
1. Remove `agents/may/handlers/auto-pause-recovery.ts` and its cron entry
2. **Saves:** 523 lines of confusing duplicate code, eliminates risk of conflicting probe markers

### P1: Extract Heartbeat Injection
3. Move heartbeat message assembly out of cron.ts into `heartbeat-injector.ts`
4. **Saves:** ~150 lines from cron.ts, makes it testable independently

### P1: Add Preflight Checks to Jobs
5. Audit 32 job entries for preflight eligibility
6. **Saves:** LLM cost on jobs that fire with no work to do

### P2: Conditional Heartbeats
7. For low-activity agents (evaluator, qa), skip heartbeat if no pending tasks
8. **Saves:** ~3,500 ops/week for those two agents alone

### P2: Documentation Reality Check
9. Update cron-tool docs to reflect centralized (May-only) architecture
10. Remove "per-agent" fiction from comments

---

## Appendix: Cron Entry Distribution

```
Total entries: 41 (40 enabled, 1 disabled)
By type: heartbeat=9, job=32

Interval distribution:
  10m:  3 entries (watchdog, agents-auto-commit, evaluation-sync)
  12h:  1 entry  (coaching-feedback)
  30m: 18 entries (most heartbeats + frequent jobs)
  1h:   9 entries
  2h:   4 entries
  4h+:  6 entries
```
