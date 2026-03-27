# Jobs & Workflows Review

**Purpose**: Inventory all automated work, evaluate effectiveness, identify what to improve or retire.
**Review cadence**: Weekly — re-run this review to track trends and catch regressions.
**Last updated**: 2026-03-12

> **Note**: Intervals and job names below reflect `agents/may/cron.json` as of 2026-03-12.
> Previous review data (session counts, quality scores) is from 2026-03-22 and may be stale.

---

## 1. JS Handlers (run in-process, no LLM)

| Name | Interval | Purpose | Verdict |
|------|----------|---------|---------|
| watchdog | 10min | Cancel sessions stuck >30min | KEEP — insurance, costs nothing |
| evaluate-sessions | 30min | Score unevaluated sessions | KEEP — core feedback loop |
| system-status | 4h | Collect metrics, write health-log.md | KEEP — useful observability |
| daily-brief | 24h | Generate daily metrics summary | KEEP — daily summary |
| coaching-report | 24h | Coaching quality report | KEEP — coaching feedback |
| focus-task-tracker | 1h | Check focus task signals | DISABLED — superseded by focus-task-driver |
| heartbeat-precheck | — | Gate all agent heartbeats (check if busy) | KEEP — prevents wasted sessions |

All handlers live in `agents/may/handlers/`.

---

## 2. Heartbeats (spawn LLM sessions via `heartbeat-precheck`)

| Name | Agent | Interval | Notes |
|------|-------|----------|-------|
| heartbeat | may | 20min | Captain oversight loop |
| heartbeat-bob | bob | 20min | Design reflection, todo drain, philosophy |
| heartbeat-optimizer | optimizer | 20min | Find & fix highest-impact problems |
| heartbeat-coach | coach | 20min | Training, coachee progress |
| heartbeat-evaluator | evaluator | 20min | Eval quality, calibration |
| heartbeat-tech-lead | tech-lead | 20min | Implementation leadership, code health |
| heartbeat-amy | amy | 30min | XHS exploration, insight synthesis |
| heartbeat-scout | scout | 30min | Research and discovery |
| heartbeat-amy-kimi | amy-kimi | 1h | **DISABLED** |

---

## 3. Detached Agent Jobs (via `run-agent-task` handler)

| Name | Agent | Interval | Purpose |
|------|-------|----------|---------|
| analyze-failures | bob | 24h | Read evaluations, identify patterns |
| optimize | optimizer | 24h | Implement one fix per day |
| lesson-consolidation | bob | 7d | Dedup/consolidate LESSONS.md files |
| focus-task-driver | bob | 1h | Drive focus tasks forward |

---

## 4. Disabled / Retired

| Name | Status | Reason |
|------|--------|--------|
| focus-task-tracker | disabled | Superseded by focus-task-driver |
| heartbeat-amy-kimi | disabled | Agent disabled |
| iraq-conflict-monitor | disabled | Temporary monitoring, done |
| philosophy-check | retired | Duplicated Bob's heartbeat |
| health-check | retired | Duplicated system-status handler |
| drain-todo | retired | Agents read todo.md during heartbeat — no separate handler needed |

---

## 5. Workflows

| Workflow | Owner | Status |
|----------|-------|--------|
| implement-and-review | may, optimizer | KEEP — core development workflow |
| test-and-fix | may | Low usage — evaluate next review |
| design-review | optimizer | KEEP — used when needed |
| safe-edit | optimizer | KEEP — prevents blind overwrite |
| enhance-cron | optimizer | KEEP — safe cron modifications |

Workflow files: `agents/optimizer/workflows/`

---

## 6. Changes Log

### Cycle 1 (2026-03-07)
- Reduced heartbeat-bob: 30m → 2h (low quality, high turn count)
- Reduced heartbeat-scout: 1d → 2d (low quality)
- Removed health-check (duplicate of system-status)
- Wired daily-brief handler to cron

### Cycle 2 (2026-03-22)
- Disabled philosophy-check (duplicates Bob's heartbeat)
- Reduced coach maxTurns: 100 → 40

### Cycle 3 (post 2026-03-22)
- All heartbeats standardized to 20-30min with `heartbeat-precheck` gating
- Added heartbeat-tech-lead
- Added focus-task-driver (bob, 1h)
- drain-todo retired — agents read todo.md during heartbeat

---

## 7. Review Cadence

This review should be re-run weekly. Key metrics:
- Agent quality % — are low performers improving?
- Avg turns per heartbeat — are heartbeats staying lean?
- Todo drain rates — are backlogs growing or shrinking?
- New entries added — are we adding jobs without retiring old ones?
- Error rates — any new job failures?
