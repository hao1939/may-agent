# Coach High-Op Pattern Analysis — 2026-04-11

**Investigation**: Why does coach consistently have high op counts (avg 28.7, peak 188)?
**Verdict**: Coach's high ops are **mostly justified** — it's doing real experimental work, not spinning wheels. But there are **3 concrete inefficiencies** worth addressing.

## Data Summary (last 24h)

| Metric | Value |
|---|---|
| Total sessions | 79 (48 heartbeats, 31 work sessions) |
| Total ops | 2,269 (#1 agent, 30% more than bob at #2) |
| Heartbeat ops | 661 (29% of total), avg 13.8, max 44 |
| Work session ops | 1,608 (71% of total), avg 51.9, max 188 |
| 7-day daily avg | 1,943 ops/day (vs 1,499 for bob, 933 for tech-lead) |

### Op Distribution by Session Type

**Heartbeats** (48 sessions): Bimodal — 32 sessions ≤ 13 ops (efficient), 16 sessions > 15 ops (bloated).

**Work sessions** (31 sessions):
- Gym trial runners: 14 sessions, avg 48 ops — running `gym-run.sh` invocations
- Investigation/design: 13 sessions, avg 53 ops — DB queries, file analysis, report writing
- Interrupted sessions: 7 sessions, 176 ops total → partial work requiring restarts

## Finding 1: Heartbeat Bloat (29% of budget, partially wasted)

Coach's heartbeat instructions say "keep lean, fork substantive work." In practice:
- **16/48 heartbeats exceeded 15 ops** (target should be ≤10)
- The worst heartbeats hit 42-44 ops — as expensive as a small work session
- **0 heartbeats have child sessions** — `agents.fork()` creates independent sessions, so we can't track which heartbeats actually dispatched work vs just rambled

The 44-op heartbeat (s_1775895819503_1300) spent most of its budget "resolving ghost deliverable warnings" — inline work that should have been forked or skipped.

**Waste estimate**: If heartbeats averaged 8 ops (reasonable target) instead of 13.8, that's ~280 saved ops/day.

## Finding 2: Experiment Fragmentation (EXP-126 needed 6 sessions, 146 ops)

Several experiments span many sessions due to interruptions:

| Experiment | Sessions | Total Ops | Interrupted |
|---|---|---|---|
| EXP-126 | 6 | 146 | 4 |
| EXP-123 | 3 | 215 | 0 |
| EXP-129 | 3 | 74 | 2 |
| EXP-131 | 2 | 73 | 1 |
| EXP-128 | 2 | 98 | 0 |

**Root cause**: Gym trials take 3-10 minutes each. A 24-trial experiment easily exceeds session time limits. Each restart costs ~5-10 ops of context reconstruction (re-reading todo, checking what's done, etc).

EXP-126 consumed 146 ops across 6 sessions for what should be a simple "run N gym trials, collect results." The first session used 60 ops just to set up and run the first ~7 trials before being interrupted.

**Waste estimate**: ~30-50 ops per fragmented experiment in restart overhead.

## Finding 3: Work Sessions Doing Everything Inline (0 child sessions)

Coach work sessions run gym trials via `execSync(cmd)` in the growth-cycle workflow, which is correct. But for free-form work sessions (not using the workflow), coach is doing everything inline:
- DB queries to analyze patterns
- Reading multiple files
- Writing design docs
- Creating scenario files
- Running gym trials
- Writing results

The 188-op session (EXP-117) investigated Bob's FM-2.6 pattern, designed an intervention, wrote scenario files, ran trials, and wrote results — all in one session. This is a **complete experiment lifecycle** in a single session, which is ambitious but not necessarily wasteful — the question is whether 188 ops was efficient for that scope.

## Comparison: Is Coach's Pattern Actually Abnormal?

| Agent | Daily Ops | Work Type |
|---|---|---|
| **coach** | **1,943** | Gym trials + experiment design + analysis |
| bob | 1,499 | Task execution + coding |
| tech-lead | 933 | Code review + architecture analysis |
| optimizer | 733 | Performance tuning |
| may | 925 | Infrastructure + orchestration |

Coach is legitimately doing the most complex work in the system — designing experiments, running gym trials (each ~3-10 min), analyzing results, creating knowledge entries. **The high absolute op count is partly justified by the nature of the work.**

However, coach also has the highest **waste ratio** due to:
1. Heartbeat bloat (29% of budget on triage, some of it doing inline work)
2. Session fragmentation (experiments interrupted mid-stream)
3. No delegation to sub-agents for mechanical tasks

## Concrete Proposals

### Proposal 1: Enforce Heartbeat Budget (Low effort, ~280 ops/day saved)

Add a budget reminder to coach's heartbeat context. The current instructions say "keep lean" but don't enforce it. A stronger signal:

> **HARD BUDGET: 10 ops max for heartbeats.** If you've used 8 ops and haven't forked yet, fork immediately with whatever you know. Do NOT resolve inline issues, update files, or run queries beyond the initial triage.

This is similar to what we did for tech-lead's heartbeat bloat (which dropped from avg 31 to ~8 after adding the warning).

### Proposal 2: Batch Gym Trials as Atomic Operations (Medium effort, ~50-100 ops/day saved)

The fragmentation problem comes from gym trials exceeding session time limits. The `growth-cycle` workflow already handles this well — it runs gym trials in Step 3 via pure JS, not LLM calls. But free-form experiment sessions (the majority of coach work) don't use the workflow.

Two options:
- **Option A**: Make coach use `growth-cycle` or `training-sprint` workflows more often instead of running free-form gym sessions. Add this to heartbeat instructions.
- **Option B**: Create a lightweight `gym-batch` workflow that just runs N trials for a given scenario/agent/fork and writes results to a file. Coach heartbeats could fork these directly: `workflow.run("gym-batch", "scenario=X agent=Y n=12")`. This would make gym execution atomic and not interruptible.

Option B is better — it separates "thinking about experiments" (which needs LLM) from "running gym trials" (which is mechanical).

### Proposal 3: Acknowledge That 188 Ops Is Fine for Full Experiments (No change)

The 188-op session produced a complete EXP-117 with investigation, design, implementation, trials, and results. For a full experiment lifecycle, that's not unreasonable — it's equivalent to ~8 growth-cycle workflow runs. The high peak number is an artifact of doing a multi-phase experiment in one session.

**Recommendation**: Don't try to break these apart. The full-experiment sessions are efficient because they don't lose context between phases. Just ensure they're using the gym-batch workflow for the trial portions.

## Priority Assessment

| Proposal | Effort | Impact | Priority |
|---|---|---|---|
| 1: Heartbeat budget | Small (edit heartbeat.md) | ~280 ops/day saved | **P1** |
| 2: gym-batch workflow | Medium (new workflow) | ~50-100 ops/day saved | **P2** |
| 3: Accept full-experiment sessions | None | Clarity | P3 |

## Bottom Line

Coach is the #1 op consumer at ~1,943 ops/day. About **15-20% is genuine waste** (heartbeat bloat + restart overhead). The remaining 80% is legitimate experimental work that's inherently op-intensive. Proposal 1 alone would bring coach closer to parity with bob.
