# Finding: What Makes Work Sessions Lean vs Bloated

**Date:** 2026-04-11  
**Dataset:** 381 non-heartbeat sessions from agents/.state/may.db (Mar 20-23)  
**Method:** Compared 66 lean sessions (15-25 ops) vs 30 bloated sessions (41+ ops)

## Key Numbers

| Metric | Lean (15-25 ops) | Bloated (41+ ops) |
|--------|------------------|-------------------|
| Sessions | 66 | 30 |
| Avg quality | 4.77 | 5.00 |
| Avg efficiency | 3.90 | 4.00 |
| Waste rate | 0.8% | 0.3% |
| Done rate | 95.5% | 96.7% |
| Avg task length | 387 chars | 432 chars |

**Critical insight**: Bloated sessions are NOT lower quality or more wasteful. They produce good results — they just take 2-3× more ops to get there. The question isn't "what goes wrong" but "what makes lean sessions efficient enough to finish in 15-25 ops?"

## Distribution (all 381 sessions)

| Bucket | Count |
|--------|-------|
| 1-5 ops | 87 |
| 6-14 ops | 155 |
| 15-25 ops | 66 |
| 26-40 ops | 43 |
| 41+ ops | 30 |

Median session is 6-14 ops. Only 8% of sessions reach 41+ ops.

## Pattern 1: Open-Ended Tasks → Bloat (47% vs 15%)

**The strongest signal.** Tasks containing "scan", "discover", "identify", or "analyze" without a bounded scope appear in 47% of bloated sessions vs 15% of lean ones.

**Bloated example (58 ops):** "Phase 1: DISCOVER a proven pattern — Scan recent sessions for proven multi-step patterns. Existing skills already cover: [long list]. Look for NEW uncovered failure modes..."  
**Lean example (25 ops):** "Phase 1: DISCOVER a proven pattern — Pattern: 'Grep-First Reading' [specific pattern already named, evidence provided]"

The difference: the lean task *pre-named the pattern to investigate*. The bloated task said "scan everything and find something new." Open-ended discovery is an unbounded search — the agent reads and reads looking for novelty without a stopping criterion.

**Actionable fix:** Pre-scope discovery tasks. Instead of "scan for patterns," specify "investigate whether pattern X exists" or "check these 5 sessions for pattern Y." Convert search to verification.

## Pattern 2: Task Type Determines Ops (Not Agent Behavior)

| Task Type | Lean Count | Bloated Count | Bloat Rate |
|-----------|-----------|---------------|------------|
| fix-bugs | 19 | 3 | 14% |
| growth-trigger | 8 | 3 | 27% |
| workflow-phase | 12 | 4 | 25% |
| discover | 1 | 8 | **89%** |
| sprint (plan+execute) | 2 | 7 | **78%** |
| diagnose | 5 | 1 | 17% |
| fork-apply | 6 | 0 | 0% |
| cron-task | 9 | 3 | 25% |

**Discover tasks** (89% bloat rate) and **sprint tasks** (78% bloat rate) are structurally prone to bloat. Bug fixes (14% bloat rate) and fork-apply (0%) are naturally lean.

**Why:** Bug-fix tasks have a clear stopping criterion (tests pass). Fork-apply tasks have a single deliverable. Discover tasks have no natural stopping point. Sprint tasks chain multiple sub-tasks.

**Actionable fix:** Treat "discover" and "sprint" as meta-tasks that should be decomposed. A 58-op "discover" session should be split: 15 ops to survey candidates → fork to investigate the best one. A sprint-plan should cap at planning only — execution goes to separate sessions.

## Pattern 3: Exact Output Specification → Lean (18% vs 3%)

Tasks that specify an exact deliverable file, format, or success criterion are 6× more common in lean sessions (18%) than bloated ones (3%).

**Lean example (24 ops):** "Fix it so `node process.js` runs successfully and produces the correct output in `output/report.json`."  
**Bloated example (58 ops):** "Plan a training sprint — identify multiple experiments to run in batch."

The lean task has a binary completion test (`node process.js` works + output matches). The bloated task has no definition of "done" — when have you identified "enough" experiments?

**Actionable fix:** Every forked/dispatched task should include a "done-when" clause:  
❌ "Analyze session patterns"  
✅ "Analyze session patterns. Done = finding-file with 3+ patterns, each with data."

## Pattern 4: Agent Specialization Masks Session Efficiency

| Agent | Sessions | Avg Ops | Median Ops |
|-------|----------|---------|------------|
| coder | 187 | 10.0 | 8 |
| bob | 9 | 11.1 | 9 |
| qa | 12 | 5.3 | 4 |
| may | 4 | 11.5 | 11 |
| optimizer | 57 | 21.1 | 13 |
| coach | 103 | 24.4 | 21 |

Coder is the leanest (avg 10 ops) not because it's better at efficiency — it gets well-scoped tasks (fix this bug, pass these tests). Coach is the bloatiest (avg 24.4) because it gets open-ended tasks (discover patterns, plan sprints, trigger growth cycles).

**This means:** The biggest lever isn't teaching agents to be more efficient — it's decomposing tasks better at the dispatch layer.

## Overlap with Existing Skills

| Existing Skill | Addresses This? |
|----------------|-----------------|
| budget-before-act | Partially — tracks turn budget but doesn't prevent open-ended tasks |
| scope-discipline | Partially — prevents scope creep within sessions but not over-scoped dispatch |
| grep-first-reading | Yes — reduces read ops but doesn't affect task structure |
| plan-once-amend | No — about plan declarations, not task scoping |

**Gap:** No skill addresses the root cause — **task decomposition at dispatch time**. The skills above help agents cope with bloated tasks, but the biggest lever is not dispatching bloated tasks in the first place.

## Recommendations

1. **Cap "discover" tasks**: Any task with "scan"/"discover"/"identify" verbs should be bounded: specify candidates to check, or cap at N files to read, or require naming the target pattern upfront.

2. **Split sprint execution**: Sprint-plan (identify experiments) and sprint-execute (run them) should be separate sessions. Sprint-plan should produce a list; execution forks one session per experiment.

3. **Require "done-when" on all dispatched tasks**: The dispatcher (heartbeat or workflow) should include a concrete completion criterion. "Done = file X exists with Y content" or "Done = test Z passes."

4. **Monitor by task type, not by agent**: Agent-level op averages are misleading. Coach's high ops come from task types, not agent behavior. Track ops by task classification (fix, discover, sprint, diagnose) to see real efficiency trends.

---

*Methodology note: Data is from agents/.state/may.db covering Mar 20-23 (812 total sessions, 381 non-heartbeat). Evaluation data available for ~60% of sessions. Bloated threshold set at 41+ ops since only 1 session hit 60+. More recent session data (Apr 9-11) was not in the queryable DB at analysis time — root may.db tables were empty, likely a sync/WAL issue.*
