# Finding: Coach Experiment Technique Analysis + session-query Adoption Status

**Date**: 2026-04-11 05:24 UTC  
**Author**: Optimizer (Mode C: Skill Scouting)  
**Status**: Complete

---

## Part 1: Coach Experiment Execution Technique

### Question
Is the 88-op EXP-130 session efficient or bloated? Is coach using gym-batch.sh? Are there technique gaps?

### Data: Recent Experiment Execution Sessions (last 24h)

| Session | Experiment | Trials | Turns | Duration | Ops/Trial |
|---------|-----------|--------|-------|----------|-----------|
| s_...1142 | **EXP-130** (few-shot discovery) | **12** | **75** | **36m** | **~6.3** |
| s_...1131 | EXP-129 (Ch2 budget curve) | 24 | — | — | (interrupted, continued below) |
| s_...1160 | EXP-129 completion (4 trials + writeup) | 4+write | 35 | 33m | — |
| s_...1096 | EXP-128 (Ch3 boundary) | 18 | 62 | 48m | ~3.4 |
| s_...1085 | EXP-128 design only | 0 | 30 | 7m | — |
| s_...1053 | EXP-126 (env hints) | 4+write | 38 | 22m | — |
| s_...1221 | EXP-131 writeup only | 0 | 38 | 7m | — |

### Key Findings

#### 1. EXP-130 at 88 ops is LEAN by coach standards

As established in the earlier archaeology finding, 88 ops for 12 gym trials is one of the more efficient experiment sessions. Historical comparison:

| Experiment | Trials | Ops | Ops/Trial |
|-----------|--------|-----|-----------|
| EXP-117 | 12+ | 188 | ~15.7 |
| EXP-123 | varied | 166 | — |
| EXP-124 | varied | 136 | — |
| EXP-127 | 24 | 91 | ~3.8 |
| **EXP-130** | **12** | **88** | **~7.3** |
| EXP-103 | 12 | 81 | ~6.8 |

The theoretical minimum for 12 trials is ~32 ops (12 bash runs + 12 result reads + 8 admin ops). EXP-130 at 88 ops is ~2.75× theoretical minimum — reasonable given context reads, error handling, analysis writeup, and git operations.

#### 2. gym-batch.sh is NOT adopted — and CAN'T be

**Critical finding**: `gym-batch.sh` was never merged to main. It exists only on `review/gym-batch-runner` branch (commit fb0f792). It is not present on disk at `scripts/gym-batch.sh`.

This means:
- Coach **cannot use** gym-batch.sh even if they knew about it
- Coach's context.md has no reference to gym-batch.sh
- Coach's skills directory has no gym-batch-related skill
- The tool was built (by optimizer) but never deployed

**Root cause chain**:
1. Optimizer built gym-batch.sh → committed to review branch
2. Nobody reviewed/merged it to main
3. Even if merged, coach doesn't know it exists (no context.md entry)

This is the same adoption failure pattern as session-query.ts — **tool built, never surfaced to users**.

#### 3. Coach technique is manual but competent

Coach's experiment execution pattern (visible from task descriptions):
1. Read experiment design.md
2. Run each trial via `scripts/gym-run.sh <scenario> --agent <agent>` (individual calls)
3. Parse results from gym DB
4. Write results.md with statistical analysis
5. Update todo.md, commit

The manual approach costs ~6-8 ops/trial. With gym-batch.sh, this could be ~1-2 ops/trial (one batch command + one results read), saving **60-75% of execution ops**.

**Estimated savings if gym-batch.sh were deployed**:
- EXP-130 (12 trials): 88 ops → ~35 ops (save ~53 ops)
- EXP-128 (18 trials): 62 ops → ~30 ops (save ~32 ops)  
- EXP-129 (24 trials): multi-session → likely single session at ~40 ops

Coach runs ~2-3 experiment execution sessions/day. Potential saving: **60-150 ops/day (~$3-7/day)**.

#### 4. The real efficiency problem is session fragmentation, not technique

EXP-129 required 3 sessions (design, execution, completion) totaling 35+?+35 = 70+ turns across multiple sessions. EXP-131 similarly split across 2 sessions. This fragmentation adds:
- Repeated context loading (~5-10 ops per session restart)
- Repeated design.md reads
- State tracking overhead (figuring out what was already done)

Single-session execution (enabled by gym-batch.sh reducing per-trial cost) would eliminate this overhead.

### Recommendations

1. **MERGE gym-batch.sh to main** — The review branch (`review/gym-batch-runner`) has a working script. Needs QA review + merge. This is the highest-ROI action.

2. **Add gym-batch.sh to coach's context.md** — After merge, add: `"Batch gym runner: scripts/gym-batch.sh --scenario <name> --agent <agent> --variants baseline,fork --trials N"`

3. **DON'T add a budget cap** — Coach experiment sessions are already getting leaner (88 ops vs 188 historical). The manual technique works; the bottleneck is tool availability, not discipline.

---

## Part 2: session-query.ts Adoption Status

### Current Status: **Zero active adoption** (unchanged from previous finding)

| Agent | Status | Evidence |
|-------|--------|----------|
| **optimizer** | ✅ Active user | Uses in heartbeat dispatches, analysis sessions |
| **may** | 📋 Passive mention | dispatch-board.md references it; no active usage |
| **qa** | 📋 Passive mention | journal.md reviewed the commit; no active usage |
| **coach** | ❌ No reference | Not in context.md, skills, handlers, or workspace |
| **bob** | ❌ No reference | Not in context.md, skills, handlers, or workspace |
| **tech-lead** | ❌ No reference | Not in context.md, skills, handlers, or workspace |
| **scout** | ❌ No reference | Not in context.md, skills, handlers, or workspace |
| **evaluator** | ❌ No reference | Not in context.md, skills, handlers, or workspace |

### Why Adoption Stalled

Three blockers identified:

1. **Filesystem history is stale** — session-query.ts reads from `agents/.state/sessions/history/`, which has 0 coach files and limited recent data. The tool is useful only for historical sessions (through ~Apr 5).

2. **No context.md entries for any agent** — Zero agents have session-query.ts in their `context.md`. Without this, agents simply don't know the tool exists. `grep -r "session-query" agents/*/context.md` returns nothing.

3. **may.db has 0 coach sessions** — The database that should be the canonical session store has no coach data. Even a may.db backend for session-query would return nothing for coach queries.

### What Changed Since Last Check

Nothing. The adoption status is identical to the finding in `finding-tool-gap-0411-b.md`. No new agents have adopted either tool.

### Recommended Fix Priority

1. **Fix may.db session sync** — This is the upstream blocker. If may.db had all sessions, session-query could use it as backend and return current data.
2. **Add context.md entries** — Even with stale data, the tool is useful for historical analysis. Add entries to at least coach, bob, and tech-lead.
3. **Don't build a may.db backend yet** — Fix the data source first, then adapt the tool.

---

## Summary

| Finding | Impact | Action |
|---------|--------|--------|
| EXP-130 at 88 ops is lean | None needed | Coach technique is fine |
| gym-batch.sh never merged | ~60-150 ops/day wasted | **Merge to main + add to coach context** |
| session-query still 0 adoption | Tool ROI unrealized | Fix may.db sync first |
| Coach session fragmentation | ~10-20 ops/day overhead | Would be fixed by gym-batch adoption |
