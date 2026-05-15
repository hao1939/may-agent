# Heartbeat Efficiency & Cost Analysis

**Date**: 2026-04-15  
**Data window**: 48h (Apr 13-15)  
**Source**: may.db sessions table

---

## 1. System Cost Overview

### Heartbeats consume 43% of all ops

| Category | Sessions | Total Ops | Avg Ops/Session |
|----------|----------|-----------|-----------------|
| Heartbeat | 857 | 6,146 | 7.2 |
| Work (non-heartbeat) | 324 | 8,111 | 25.0 |
| **Total** | **1,181** | **14,257** | — |

Heartbeats fire 2.6x more sessions but consume fewer ops per session. The question is: **what do those 6,146 heartbeat ops actually produce?**

### Per-Agent Heartbeat Cost (48h → normalized to /day)

| Agent | HB Sessions/day | Ops/day | Avg Ops/HB | Avg Duration(s) | Interrupt % |
|-------|-----------------|---------|------------|------------------|-------------|
| tech-lead | 54 | 758 | 14.0 | 334s | 7.4% |
| optimizer | 50 | 455 | 9.1 | 338s | 9.0% |
| may | 41 | 441 | 10.9 | **1,246s** | **27.2%** |
| scout | 40 | 326 | 8.1 | 120s | 10.0% |
| bob | 40 | 294 | 7.3 | 539s | 10.0% |
| coach | 44 | 288 | 6.6 | 320s | 10.3% |
| qa | 38 | 269 | 7.2 | 70s | **40.0%** |
| evaluator | 120 | 158 | 1.3 | 21s | 2.1% |
| coder | 4 | 87 | 24.7 | 306s | 14.3% |

**Key findings:**
- **Tech-lead** is the most expensive heartbeat agent (758 ops/day) — 38 of 108 heartbeats used >8 ops (35% "high-op")
- **May** has the longest heartbeat duration (1,246s avg = **21 minutes**!) and 27% interrupt rate
- **QA** has a 40% interrupt rate — heartbeats get killed before completing
- **Evaluator** runs 120 sessions/day but 180 of 239 used **0 ops** — pure preflight-skip pattern

---

## 2. What Heartbeats Actually Produce

### Op Distribution (are heartbeats doing work or just checking?)

| Agent | ≤3 ops (checking) | 4-8 ops (light triage) | >8 ops (real work) |
|-------|-------------------|------------------------|---------------------|
| evaluator | 195 (82%) | 38 (16%) | 6 (3%) |
| coach | 27 (31%) | 45 (52%) | 15 (17%) |
| tech-lead | 9 (8%) | 61 (56%) | **38 (35%)** |
| optimizer | 6 (6%) | 67 (67%) | 27 (27%) |
| may | 6 (7%) | 63 (78%) | 12 (15%) |
| bob | 7 (9%) | 51 (64%) | 22 (28%) |
| scout | 2 (3%) | 56 (70%) | 22 (28%) |
| qa | 2 (3%) | 61 (81%) | 12 (16%) |

**Insight**: Most heartbeats land in the 4-8 ops "light triage" band. This is the dispatcher pattern working: observe → decide → fork. The high-op sessions (>8) are where heartbeats are doing inline work they should be forking.

### Heartbeat → Work Session Conversion

Heartbeats fork real work sessions via `agents.fork`:

| Agent | Forked Sessions (48h) | Forked Ops | Avg Ops/Fork |
|-------|----------------------|------------|--------------|
| bob | 59 | 1,542 | 26.1 |
| optimizer | 57 | 1,273 | 22.3 |
| coach | 30 | 643 | 21.4 |
| coder | 34 | 643 | 18.9 |
| tech-lead | 36 | 542 | 15.1 |
| scout | 14 | 387 | 27.6 |

**This is the value of heartbeats**: they dispatch 236 fork sessions doing 5,134 ops of real work. The 6,146 heartbeat ops are the coordination overhead that enables 5,134 ops of directed work.

**Cost ratio**: 1.2 ops of heartbeat overhead per 1 op of directed work. Not terrible, but room to improve.

---

## 3. Cron Job Audit

### 44 total cron entries: 26 JS handlers (no LLM) + 15 LLM handlers + 3 disabled

**JS handlers (free — no LLM cost):**

| Frequency | Count | Jobs |
|-----------|-------|------|
| 5min | 2 | active-nudge, session-sync |
| 10min | 3 | watchdog, agents-auto-commit, evaluation-sync |
| 30min | 4 | convention-check, evaluator-heartbeat, repo-gate-check, heartbeat-context, research-sync |
| 60min | 3 | zombie-cleanup, task-watchdog, metrics-snapshot |
| 120min | 2 | proof-of-life, audit-requests |
| 240min | 3 | system-status, tracker-compact, tool-quality-scan |
| Daily | 7 | daily-brief, analyze-failures, coaching-report, lessons-graduation, workspace-compaction, memory-trimmer, daily-digest |
| Weekly | 1 | health-trend |

**Verdict**: JS handlers are essentially free. Some could be consolidated (2 daily digest jobs?) but the savings are negligible.

**LLM handlers (costs real tokens):**

| Job | Interval | Agent | Ops (48h) | Notes |
|-----|----------|-------|-----------|-------|
| 7 agent heartbeats | 30min | various | 6,146 | Core coordination loop |
| common-sense-verify | 4h | coach | 171 | 7 runs, 24.4 ops/run |
| error-scan | 4h | — | — | Workflow-based |
| reflect | 6h | coach | 117 | 5 runs, 23.4 ops/run |
| coaching-feedback-wf | 12h | — | — | Workflow-based |
| optimize | daily | optimizer | 62 | 2 runs, 31 ops/run |
| common-sense-infra | daily | bob | 30 | 2 runs, 15 ops/run |
| training-sprint | daily | — | — | Workflow-based |
| research-intake | daily | coach | 35 | 2 runs, 17.5 ops/run |

**Verdict**: Non-heartbeat LLM cron jobs used ~415 ops over 48h = ~208 ops/day. That's modest — 7% of daily ops. The heartbeats are the dominant cost.

---

## 4. Identified Waste & Inefficiency

### 4.1 Evaluator: 180 zero-op sessions/48h
The evaluator heartbeat runs every 30min via a JS handler. 75% of the time (180/239) it fires a session that does literally nothing (0 ops). The handler should have a more aggressive preflight check.

**Waste**: ~180 session-creation events with no value. No LLM cost (0 ops), but DB/infra overhead.

**Fix**: Better preflight in the `evaluator-heartbeat` handler — check if new sessions exist before spawning.

### 4.2 QA: 40% interrupt rate
QA's heartbeats get interrupted 40% of the time (30 of 75). The 70-second average duration suggests QA is hitting budget limits or concurrent session limits.

**Waste**: 30 interrupted sessions × ~5 ops = ~150 wasted ops/48h.

**Fix**: Investigate why QA heartbeats are interrupted. Likely concurrency conflict with QA work sessions.

### 4.3 May: 21-minute average heartbeat
May's heartbeat averages 1,246 seconds (21 minutes). This is 10x longer than QA (70s) and 4x longer than tech-lead (334s). The 7-step heartbeat.md is the most complex of all agents.

**Waste**: Not ops waste (10.9 avg is reasonable) — it's wall-clock blocking. May's heartbeat takes so long that it gets interrupted 27% of the time by the next heartbeat cycle.

**Root cause**: May's heartbeat.md has 7 steps including "Proactive Review (Gatekeeper)" and "Research Projects" that expand the scope beyond dispatch. Most other agents have 2-3 steps.

**Fix**: May's heartbeat is a special case (coordinator role), but steps 3 (Gatekeeper), 5 (Research Projects), and 6 (System Health) overlap with cron jobs that already handle these:
- Gatekeeper → `repo-gate-check` cron already runs every 30min
- System Health → `system-status`, `watchdog`, `zombie-cleanup` already handle this
- Research Projects → `research-sync` cron handles project status

### 4.4 Tech-lead: 35% high-op heartbeats
Tech-lead has 38 heartbeats with >8 ops — suggesting inline work rather than fork-and-dispatch. At 14 avg ops, tech-lead heartbeats are 2x the budget of most agents.

**Waste**: ~380 ops/48h above the 8-op target = ~190 excess ops/day.

**Fix**: Tighten tech-lead's heartbeat.md to enforce forking for anything >3 ops. Add a budget reminder like optimizer has.

### 4.5 Duplicate system snapshots
All 6 dispatch-pattern heartbeats (may, bob, coach, scout, tech-lead, optimizer) run nearly identical DB queries in Step 1:
```sql
SELECT agent, COUNT(*) as n, ROUND(AVG(opCount)) as ops, 
SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errs 
FROM sessions WHERE startedAt > ? GROUP BY agent
```
This query runs 6×48 = 288 times per 48h, producing identical results within each 30-min window.

**Fix**: The `heartbeat-context` cron (JS, 30min) could pre-compute this snapshot and write it to a file. Heartbeats read the file instead of querying. Saves ~288 bash ops per 48h.

### 4.6 Overlapping daily cron jobs
Two daily digest-type jobs exist:
- `daily-brief` (JS handler)
- `daily-digest` (JS handler)

Plus `coaching-report` and `analyze-failures` are both daily analysis jobs that likely overlap.

**Fix**: Audit and consolidate. Likely can merge daily-brief + daily-digest.

---

## 5. Proposals

### Proposal A: Minimal Viable Heartbeat (target: -25% heartbeat ops)

**Current**: 6,146 heartbeat ops/48h = 3,073/day  
**Target**: ~2,300/day

| Change | Savings (ops/day) | Risk |
|--------|-------------------|------|
| Pre-compute system snapshot (eliminate duplicate queries) | ~144 | Low — JS cron writes a file |
| Fix evaluator preflight (eliminate 0-op sessions) | 0 (already 0 ops) | None — just cleaner |
| Reduce tech-lead heartbeat inline work | ~95 | Low — just stricter forking |
| Remove May heartbeat steps 3/5/6 (covered by crons) | ~50 | Medium — gatekeeper role is important |
| Fix QA interrupt rate | ~75 | Medium — need to find root cause |
| **Total** | **~364** | |

That's only a 12% reduction. The truth is: **heartbeats are already fairly lean** thanks to the dispatcher pattern. The remaining cost is inherent coordination overhead.

### Proposal B: Reduce heartbeat frequency for low-value agents (target: -30%)

Some agents don't need 48 heartbeats/day:

| Agent | Current | Proposed | Savings |
|-------|---------|----------|---------|
| evaluator | every 30min (120/day, 82% empty) | Driven by evaluation-sync event, not timer | ~158 ops/day |
| qa | every 30min (38/day, 40% interrupted) | every 60min | ~134 ops/day |
| coder | every 30min (4/day — already low) | event-driven only | ~87 ops/day |

**⚠️ NOTE**: The project has a firm "no heartbeat skipping" policy. This proposal conflicts with that. These agents still need heartbeats to discover initiative work. The value is in the heartbeats that DO find work.

### Proposal C: Shift Work From Heartbeats to Event-Driven Crons (Strategic)

**This is the real opportunity.** Hao's observation is correct: heartbeats should be for autonomous initiative, not routine tasks. The issue isn't heartbeat cost — it's heartbeat *content*.

What should **leave** heartbeats and become cron jobs:
1. **System snapshot queries** → `heartbeat-context` cron already exists, just needs to write a summary file
2. **Failure triage** → `error-scan` and `analyze-failures` already exist. May's Step 4 duplicates them.
3. **System health checks** → fully covered by `watchdog`, `zombie-cleanup`, `system-status`
4. **Convention checking** → `convention-check` cron handles this

What should **stay** in heartbeats (autonomous/creative):
1. **Dispatch decisions** — requires judgment about priorities
2. **Initiative work** — discovering new things to investigate
3. **Research direction** — choosing what to explore next
4. **Cross-agent coordination** — routing work between agents

### The "Minimal Viable Heartbeat" Template

```markdown
# Agent Heartbeat — Minimal Viable

## Step 1: OBSERVE (1 op)
Read `agents/shared/system-snapshot.md` (pre-computed by cron).
Check "Injected: pending tasks" above.

## Step 2: DECIDE + DISPATCH (1-2 ops)
Pick ONE thing. Fork it. Update todo.md if needed.

## Step 3: INITIATIVE (0-3 ops)
If nothing pending: what should this agent explore/improve?
Fork a work session. If nothing to do, that's fine — call finish().
```

**Target: 3-5 ops per heartbeat, 2-3 minutes**

---

## 6. Cost Savings Summary

| Approach | Savings/day | Implementation Effort | Risk |
|----------|-------------|----------------------|------|
| Pre-compute system snapshot | 144 ops | Low (modify heartbeat-context handler) | Low |
| Tighten tech-lead budget | 95 ops | Low (edit heartbeat.md) | Low |
| Trim May heartbeat (remove cron-covered steps) | 50 ops | Low (edit heartbeat.md) | Medium |
| Fix QA interrupt rate | 75 ops | Medium (diagnose root cause) | Low |
| Event-drive evaluator | 0 ops (just cleaner) | Low | Low |
| **Tactical total** | **~364 ops/day (12%)** | | |
| Adopt minimal heartbeat template | **~750 ops/day (24%)** | High (rewrite all heartbeat.mds) | Medium |

### Bottom Line

**Heartbeats aren't the main cost problem.** At 43% of ops, they're significant but they produce the 236 forked work sessions that do real work. The dispatcher pattern is sound.

The real issue is **content creep**: heartbeats gradually accumulate routine checking steps that duplicate what cron jobs already do. The fix isn't killing heartbeats — it's **slimming heartbeat content** to focus on what only an LLM can do: judgment calls about priorities, initiative, and coordination.

**Recommended priority order:**
1. **Pre-compute system snapshot** (easy win, saves duplicate queries across all agents)
2. **Trim May's heartbeat steps 3/5/6** (covered by crons, biggest single-agent saving)
3. **Add budget reminder to tech-lead** (like optimizer has)
4. **Diagnose QA interrupt rate** (40% waste is unacceptable)
5. **Adopt minimal heartbeat template** across agents (biggest long-term win, highest effort)
