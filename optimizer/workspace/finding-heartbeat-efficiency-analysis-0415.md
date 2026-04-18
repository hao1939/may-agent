# Heartbeat Efficiency Analysis — What Should Stay, What Should Go?

**Date**: 2026-04-15  
**Author**: Optimizer  
**Request**: Hao's observation — "The heartbeat now handles a lot of routine tasks, which is not by design: the heartbeat is for agents to be autonomous and evolving."

---

## Executive Summary

Heartbeats consume **~3,200 ops/day** across 8 active agents (~340 sessions/day). This is **47% of daily LLM ops** — the single largest cost category. But the picture is nuanced:

- **Some heartbeats are working as intended**: May dispatching, Bob/Coach/Scout/Tech-lead triaging then forking deep work
- **Some heartbeats do the same thing every time**: QA runs `git log` + code review every cycle — this is routine, not autonomous
- **One heartbeat is already migrated well**: Evaluator's heartbeat is now a JS gatekeeper that only spawns LLM when needed (74% idle rate = successful gate)
- **Several heartbeat steps are mechanical**: system snapshots, board reads, pending task checks — these could be pre-computed by JS

**Bottom line**: 30-40% of heartbeat ops are spent on routine/mechanical steps that don't require LLM judgment. Migrating these to JS handlers could save **~1,000-1,300 ops/day**.

---

## 1. Per-Agent Heartbeat Inventory

### May (309 sessions/7d, avg 16 ops, ~720 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| System snapshot | SQL query: agent activity, errors, stuck sessions | **MOVE** — Pure SQL, already templated |
| Dispatch work | Read board, match tasks to agents, fork sessions | **KEEP** — Requires judgment |
| Follow up | Check board status vs DB snapshot, update board | **MOVE (partial)** — Status check is mechanical; deciding what to do about stale items needs judgment |
| Proactive review | Check what agents are doing, flag system-scope changes | **KEEP** — Core autonomous value |
| Triage failures | Route failures to right helper | **KEEP** — Requires classification judgment |
| Research projects | Check shared/projects/ directory | **MOVE** — Directory listing, flag changes |
| System health | Check stuck sessions | **MOVE** — Already in snapshot, redundant |
| Improvement queue | Pick top item, fork session | **KEEP** — Proactive improvement |

**Summary**: ~30% of May's heartbeat is mechanical (snapshot, directory checks, status reads). If pre-computed into heartbeat-context.md (already exists!), May could skip 4-5 ops per cycle.

### Bob (309 sessions/7d, avg 12 ops, ~530 ops/day)  
| Step | What It Does | Classification |
|------|-------------|----------------|
| Observe | Read experiments, deep-dives, KB commits, todo.md | **MOVE (partial)** — File listing is mechanical |
| Decide | Pick highest-priority task | **KEEP** — Core judgment |
| Dispatch | Fork work sessions via workflows | **KEEP** — Orchestration |
| Exit | Research log, finish() | **KEEP** — Record-keeping |

**Summary**: Bob's heartbeat is well-structured as a dispatcher. 13% idle rate means it's finding work 87% of the time. The observation step (scanning files/git) could be pre-computed. **~2-3 ops/cycle saveable**.

### Coach (314 sessions/7d, avg 11 ops, ~480 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Observe | DB query, experiment listing, todo.md | **MOVE (partial)** — Queries are templated |
| Decide | Pick task priority | **KEEP** — Judgment |
| Running-session guard | Check if work session already running | **MOVE** — Pure SQL, deterministic |
| Dispatch | Fork growth-cycles, training-sprints, investigations | **KEEP** — Core value |
| Exit | finish() | **KEEP** |

**Summary**: Coach's 32% idle rate is concerning — 1 in 3 heartbeats find nothing to do. The running-session guard (mandatory SQL check) could be a JS preflight that skips the LLM session entirely when a work session is already running. **Could eliminate ~38 idle sessions/3d**.

### Optimizer (370 sessions/7d, avg 11 ops, ~590 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Observe | DB snapshot, high-op query, todo.md | **MOVE** — Templated queries |
| Decide | Pick exploration mode | **KEEP** — Pattern recognition |
| Act | Fork work via workflows | **KEEP** — Core value |
| Exit | finish() | **KEEP** |

**Summary**: Optimizer has 7% idle rate but 8% bloated (>30 ops) rate — it sometimes does work inline instead of forking. The 11 bloated sessions in 3 days are the real waste. Observation queries could be pre-computed. **~2-3 ops/cycle saveable**.

### Tech-Lead (346 sessions/7d, avg 12 ops, ~600 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Observe | DB snapshot, high-op query, todo.md | **MOVE** — Same templated query as optimizer |
| Decide | Pick lens or feature work | **KEEP** — Engineering judgment |
| Feature rotation | Check dispatch-board for features | **MOVE (partial)** — Board reading is mechanical |
| Act | Fork lens-analysis, implement-and-verify | **KEEP** — Core value |
| Exit | finish() | **KEEP** |

**Summary**: 13 bloated sessions (>30 ops) in 3d — similar pattern to optimizer. Feature rotation check is mechanical. **~2-3 ops/cycle saveable**.

### Scout (290 sessions/7d, avg 13 ops, ~520 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Observe | Git log, pending tasks, todo.md | **MOVE** — File/git scanning |
| Decide | Pick research topic | **KEEP** — Research intuition |
| Dispatch | Fork verify-wrap work sessions | **KEEP** — Core value |
| Record & exit | Update todo.md, research_log | **KEEP** |

**Summary**: Scout is well-disciplined (only 2% idle, 5 bloated). Observation could be pre-computed but savings are small. **~2 ops/cycle saveable**.

### QA (285 sessions/7d, avg 8 ops, ~330 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Pending reviews | Check injected tasks, do top one | **KEEP** — But only when tasks exist |
| Proactive scan | `git log`, read diffs, code review | **MOVE** — This is the routine part |
| Close out | Append to journal.md | **MOVE** — Mechanical journaling |
| Exit | finish() | **KEEP** |

**Summary**: QA's heartbeat is **the most routine of all active heartbeats**. The "proactive scan" is the same algorithm every time: check git log → pick unreviewed commit → read diff → write findings. This is a textbook case for a JS sensor + LLM judge pattern (like error-scan and coaching-feedback already use). The `repo-gate-check` JS handler already does half of this! QA's heartbeat could be replaced by expanding that handler.

### Evaluator (497 sessions/7d, avg 3 ops, ~220 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| All steps | Calibration check, signal quality, periodic tasks | **ALREADY MIGRATED** — JS gatekeeper |

**Summary**: Evaluator is the **success story**. The JS `evaluator-heartbeat` handler gates LLM spawn — 74% of heartbeats are idle (≤3 ops), meaning the JS handler correctly determined no LLM work was needed. This saved ~250 ops/day compared to always spawning. **This is the model for other migrations.**

### Coder (9 sessions/7d, avg 21 ops, ~30 ops/day)
| Step | What It Does | Classification |
|------|-------------|----------------|
| Check spec | Read SPEC.md | **KEEP** — Needs to understand context |
| Check progress | Read progress.md | **MOVE** — Could be pre-checked |
| Continue building | Implementation work | **KEEP** — Core value |

**Summary**: Coder is rarely triggered via heartbeat (only 9 sessions/7d). It's mostly dispatched by tech-lead. Low volume, low concern.

### Amy-Kimi (2 sessions/7d, disabled locally)
**Summary**: Disabled. Not relevant for cost analysis.

### Amy (no heartbeat in cron.json)
**Summary**: Amy has a heartbeat.md but no cron entry triggering it. Effectively inactive.

---

## 2. Cost Summary

### Current State (7-day averages, extrapolated to daily)

| Category | Sessions/day | Ops/day | % of total |
|----------|-------------|---------|------------|
| **Heartbeats** | ~390 | ~4,020 | **47%** |
| **Work sessions** | ~112 | ~3,070 | **36%** |
| **Cron jobs** (LLM-using) | ~13 | ~326 | **4%** |
| **Other** | ~31 | ~669 | **8%** |
| **Pure JS handlers** | ~75+ | 0 | 0% (no LLM) |
| **TOTAL** | ~546 | ~8,085 | 100% |

### Heartbeat Ops Breakdown

| Agent | Ops/day | Mechanical ops/day | Saveable |
|-------|---------|-------------------|----------|
| May | 720 | ~250 | 35% |
| Tech-lead | 600 | ~200 | 33% |
| Optimizer | 590 | ~180 | 31% |
| Bob | 530 | ~140 | 26% |
| Scout | 520 | ~130 | 25% |
| Coach | 480 | ~180 | 38% |
| QA | 330 | ~200 | 61% |
| Evaluator | 220 | (already gated) | — |
| **TOTAL** | **3,990** | **~1,280** | **32%** |

**Potential savings: ~1,280 ops/day = 15% of total system ops**

---

## 3. Classification Summary

### KEEP — Genuinely Autonomous (belongs in heartbeats)
These steps require LLM judgment, evolve over time, and produce unique decisions each cycle:

1. **May: Dispatch decisions** — Matching tasks to agents requires understanding agent capabilities, current load, and task nature
2. **May: Proactive review / Gatekeeper** — Detecting system-scope changes requires understanding intent, not just file diffs
3. **May: Failure triage** — Classifying "why did this fail?" requires reasoning
4. **May: Improvement queue** — Picking and prioritizing improvements
5. **Bob: Decide & dispatch** — Choosing what to think about next requires intellectual judgment
6. **Coach: Decide & dispatch** — Choosing which experiments/investigations to run
7. **Optimizer: Decide & dispatch** — Choosing which inefficiency to investigate
8. **Tech-lead: Decide & dispatch** — Choosing between infra/feature work, picking lenses
9. **Scout: Research topic selection** — Deciding what's worth researching
10. **All dispatchers: Forking work sessions** — The actual orchestration

### MOVE — Routine/Mechanical (should be JS handlers or pre-computation)

| Item | Agent(s) | Current Cost | Migration Target | Est. Savings |
|------|----------|-------------|-----------------|-------------|
| **System snapshot SQL** | May, Coach, Optimizer, Tech-lead | ~4 ops/day × 4 agents = ~400 ops/day (included in per-agent totals but each agent runs the same query pattern) | Already exists: `heartbeat-context` handler. **Expand it** to include agent-specific data (errors, high-ops, stuck sessions) so agents skip their own query step. | ~1-2 ops/cycle × ~500 cycles = **~700 ops/day** |
| **Running-session guard** | Coach | ~1 op/cycle × 40 cycles/day = ~40 ops/day | JS preflight in cron.json. If coach work session is running, skip heartbeat entirely. | **~40 ops/day** (plus eliminates ~13 idle sessions/day) |
| **QA proactive scan** | QA | ~5 ops/cycle × ~37 cycles/day = ~185 ops/day | Expand `repo-gate-check` to include the full scan (git log + identify unreviewed commits). Only spawn QA LLM when there's something to review. Same pattern as evaluator-heartbeat. | **~120 ops/day** |
| **Directory/git scanning** | Bob, Scout | ~2 ops/cycle × ~60 cycles/day = ~120 ops/day | Pre-compute in `heartbeat-context` handler: recent experiments, deep-dives, KB commits. Inject as context. | **~80 ops/day** |
| **Dispatch board status read** | May, Tech-lead | ~1 op/cycle × ~80 cycles/day = ~80 ops/day | Pre-compute board summary in heartbeat-context. Inject pending items + status. | **~50 ops/day** |
| **Journal appending** | QA | ~2 ops/cycle × ~37 cycles/day = ~74 ops/day | Write findings to a structured format (JSONL) instead of append-only markdown. Or have JS handler do it. | **~40 ops/day** |

### REMOVE — Dead Weight

| Item | Agent | Current Cost | Rationale |
|------|-------|-------------|-----------|
| **Evaluator idle heartbeats** | Evaluator | ~150 idle sessions × 2 ops = ~300 ops/3d = ~100 ops/day | 74% of evaluator heartbeats are idle. The JS gatekeeper works, but it still spawns a minimal LLM session. Could the JS handler itself do the 2-3 op check without LLM? Likely yes — just query DB for staleness. | 
| **Coach idle heartbeats** | Coach | ~13 idle sessions/day × 3 ops = ~39 ops/day | When a work session is already running, the heartbeat just checks and exits. A JS preflight could prevent the LLM spawn. |
| **Redundant "system health" step** | May | ~0.5 ops/cycle (already uses snapshot) | May's heartbeat has system health as a separate step, but the data is already in the system snapshot. The step itself says "Already covered by the system snapshot query." Redundant by design — just hasn't been removed from the doc. |

---

## 4. Migration Plan

### Priority 1: Expand `heartbeat-context` handler (Saves ~700 ops/day)
**What**: The `heartbeat-context.ts` handler already pre-computes system context. Expand it to include:
- Per-agent error summary (last 1h, last 6h)
- High-op session list
- Stuck session list  
- Recent git commits in agents/
- Dispatch board summary
- Recent experiment/deep-dive listings

**How**: Modify `agents/may/handlers/heartbeat-context.ts` to write richer per-agent context sections. Each agent's heartbeat then reads `heartbeat-context.md` instead of running its own SQL queries.

**Impact**: Every dispatcher agent (May, Bob, Coach, Optimizer, Tech-lead, Scout) saves 1-3 ops/cycle on observation. At ~500 heartbeat sessions/day, this is the highest-leverage single change.

**Effort**: Low — the handler exists, just needs more queries added.

### Priority 2: QA heartbeat → sensor-judge pattern (Saves ~120 ops/day)
**What**: Convert QA's heartbeat to the same sensor-judge pattern used by evaluator, error-scan, and coaching-feedback:
1. JS sensor: `repo-gate-check` already detects new commits. Expand it to identify which commits lack QA review.
2. LLM judge: Only spawn QA LLM session when there are unreviewed commits to actually read.

**How**: 
1. Add review-tracking to `repo-gate-check.ts` (track which commits QA has reviewed)
2. Create `qa-heartbeat.ts` JS handler that checks for unreviewed commits + pending review requests
3. Only spawn LLM session when there's actual work

**Impact**: QA's 104 heartbeats/3d could drop to ~40 (only when there's work), saving ~120 ops/day.

**Effort**: Medium — needs new handler + tracking state.

### Priority 3: Coach preflight guard (Saves ~40 ops/day + eliminates idle sessions)
**What**: Add a JS preflight to coach heartbeat that checks if a work session is already running. If yes, skip the LLM heartbeat entirely.

**How**: Add preflight config to cron.json:
```json
{
  "name": "heartbeat-coach",
  "preflight": {
    "type": "custom",
    "handler": "coach-preflight",
    "condition": "no-running-work-session"
  }
}
```

**Impact**: Eliminates ~13 idle sessions/day. Small ops savings but reduces noise and session clutter.

**Effort**: Low — simple SQL check in JS.

### Priority 4: Evaluator full-JS migration (Saves ~100 ops/day)
**What**: The evaluator JS gatekeeper still spawns a minimal LLM session 74% of the time just to exit. If the "check if calibration needed" logic is simple enough, do it entirely in JS.

**How**: Review what the 2-3 op LLM sessions actually do. If it's just "query DB, find nothing, exit" — move that to the JS handler. Only spawn LLM for actual calibration work.

**Impact**: Eliminates ~150 idle LLM sessions over 3 days = ~50 sessions/day × 2 ops = ~100 ops/day.

**Effort**: Medium — need to verify the LLM isn't doing subtle judgment in those 2-op sessions.

### Priority 5: Scout/Bob observation pre-computation (Saves ~80 ops/day)
**What**: Pre-compute experiment listings, deep-dive listings, and git log into heartbeat-context.md sections for each agent.

**How**: Part of Priority 1 (heartbeat-context expansion). These agents' observe steps scan files/git — pre-compute that.

**Impact**: ~80 ops/day across Scout and Bob.

**Effort**: Low (part of P1).

---

## 5. What Should NOT Change

### Don't remove heartbeats entirely
Heartbeats are the autonomy mechanism. Even if 30% of ops are mechanical, the 70% that's judgment-based is where agents make independent decisions about what to work on. Without heartbeats, agents become purely reactive (only responding to dispatches).

### Don't skip idle heartbeats
Per standing order: "heartbeats must always fire." The system already tried idle-skipping and removed it. The cost of missing initiative work outweighs the savings.

### Don't merge heartbeat steps
Per KE-008: "Do NOT restructure heartbeat steps. Heartbeat regressions are caused by structural changes, not content."

### Don't convert dispatcher decision-making to JS
The DECIDE step in each dispatcher heartbeat is where agents apply judgment — "what's most important right now?" This cannot be reduced to a rule. It's the core value of heartbeats.

---

## 6. The Big Picture: Heartbeat's Intended Role

Hao's observation is correct. The heartbeat was designed for **autonomous, evolving work** — agents noticing things, making judgment calls, initiating improvements. Over time, routine tasks accumulated:

- System snapshot queries (everyone runs the same SQL)
- Board reading (mechanical state check)
- Directory scanning (file listings)
- Journal appending (mechanical bookkeeping)
- Running-session guards (deterministic SQL checks)

These are **infrastructure concerns** that crept into agent judgment sessions because it was easier to add a step to the heartbeat than to build a JS handler.

The fix is not to remove heartbeats but to **push the mechanical floor down into JS**:
1. JS handlers pre-compute state → write to context files
2. JS preflights gate LLM sessions → only spawn when there's actual judgment work
3. LLM heartbeats start with pre-digested context → spend all ops on judgment and dispatch

The evaluator migration is the proof: a JS gatekeeper reduced evaluator from one of the most expensive heartbeats to the most efficient, while preserving all autonomous capability.

---

## 7. Recommended Next Steps

1. **Immediate (this week)**: Expand `heartbeat-context.ts` to include error summaries, high-op lists, stuck sessions, and git activity. This is P1 — biggest bang for the buck.
2. **This week**: Add coach preflight guard (low effort, immediate impact).
3. **Next week**: Design QA sensor-judge pattern. Write brief, have tech-lead implement.
4. **Next week**: Audit evaluator's idle sessions to determine if full-JS migration is feasible.
5. **Ongoing**: As new heartbeat steps are added, ask "is this judgment or infrastructure?" Route infrastructure to JS.

---

## Appendix: Raw Data

### 7-Day Heartbeat Cost by Agent
| Agent | Sessions | Avg Ops | Total Ops | Errors | Idle% (≤3 ops) |
|-------|----------|---------|-----------|--------|-----------------|
| May | 309 | 16 | 5,040 | 2 | 6% |
| Tech-lead | 346 | 12 | 4,189 | 0 | 13% |
| Optimizer | 370 | 11 | 4,149 | 1 | 7% |
| Bob | 309 | 12 | 3,672 | 0 | 13% |
| Scout | 290 | 13 | 3,644 | 1 | 2% |
| Coach | 314 | 11 | 3,378 | 1 | 32% |
| QA | 285 | 8 | 2,311 | 1 | 2% |
| Evaluator | 497 | 3 | 1,546 | 1 | 74% |
| Coder | 9 | 21 | 191 | 0 | 14% |

### Daily Totals (last 3 days)
| Day | Total Sessions | Total Ops | Heartbeat Ops | Heartbeat % |
|-----|---------------|-----------|---------------|-------------|
| Apr 15 (partial) | 413 | 4,327 | 2,023 | 47% |
| Apr 14 | 604 | 8,104 | 3,223 | 40% |
| Apr 13 | 506 | 6,935 | 3,293 | 47% |

### Op Distribution by Session Type (7-day)
| Type | Sessions | Total Ops | Avg Ops |
|------|----------|-----------|---------|
| Heartbeat | 2,731 | 28,142 | 10 |
| Work session | 785 | 21,507 | 27 |
| Other | 215 | 4,685 | 22 |
| Cron (LLM) | 94 | 2,285 | 24 |
