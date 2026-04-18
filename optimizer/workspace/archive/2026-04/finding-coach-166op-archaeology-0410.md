# Finding: Coach High-Op Session Archaeology — 184-Op Deep Dive

**Date**: 2026-04-10  
**Scope**: Top 3 coach sessions by opCount (184, 140, 129), transcript-level analysis  
**Method**: Tool call extraction from session.jsonl transcripts, category classification, phase/restart analysis  
**Prior work**: `finding-coach-session-efficiency-0410.md` (broad analysis of 2,175 sessions)

## Executive Summary

The highest-op coach sessions (184, 140, 129) are **not single bloated sessions** — they're sessions that survived multiple process restarts, accumulating ops across 6-13 "lives" within one session ID. The 184-op session had **6 restarts** (7 segments), and the 129-op session had **12 restarts** (13 segments). This changes the diagnosis: the primary driver isn't behavioral bloat within a single context window, but **infrastructure-level session persistence** that lets sessions accumulate indefinitely.

Within individual segments, the patterns match the prior finding: 45% exploratory ops, 31% productive. But the magnitude comes from restart-driven accumulation, not from the agent doing 184 ops in one continuous context.

## Session Profiles

### Session 1: s_1775288326361_10 (184 ops, INTERRUPTED)
- **Task**: Resume training — EXP-216 regression awareness, wrong-tool-args scenarios, skill A/B tests
- **Duration**: 386 minutes (~6.4 hours)
- **Cost**: $12.34 (3.9M input tokens, 44K output tokens)
- **LLM turns**: 211
- **Avg input/turn**: 18,441 tokens
- **Restarts**: 6 (7 segments)
- **Status**: interrupted (aborted)

| Category | Count | % |
|----------|-------|---|
| other-bash | 51 | 22.3% |
| gym-run | 41 | 17.9% |
| file-inspect | 34 | 14.8% |
| search | 27 | 11.8% |
| read | 22 | 9.6% |
| discovery | 20 | 8.7% |
| edit | 11 | 4.8% |
| write | 7 | 3.1% |
| agents | 6 | 2.6% |
| checkpoint | 3 | 1.3% |
| finish | 3 | 1.3% |

**Productive**: 72 (31.4%) — **Exploratory**: 103 (45.0%) — **Other**: 54 (23.6%)

#### Segment Breakdown
| Segment | Ops | Duration | Primary Activity |
|---------|-----|----------|-----------------|
| 0 (initial) | 110 | 40 min | Discovery + gym baselines + EXP-023 |
| 1 (restart) | 65 | 27 min | More gym runs + scenario sweeps |
| 2 (restart) | 22 | 281 min | Idle/slow gym runs |
| 3 (restart) | 0 | 9 min | Empty (crashed immediately) |
| 4 (restart) | 20 | 8 min | Reading results, inspection |
| 5 (restart) | 7 | 10 min | Gym tail-end |
| 6 (restart) | 5 | ongoing | Final gym runs before abort |

**Key observation**: Segment 0 alone (110 ops) is already 3x a normal session. It contains 14 gym runs, 14 discovery ops, and 15 file inspections — the coach tried to do everything from its task list in one go.

### Session 2: s_1775293574680_13 (140 ops, ERROR)
- **Task**: Cron training-sprint
- **Error**: LiteLLM model not available (claude-sonnet-4-20250514)
- **Duration**: 262 minutes
- **Status**: error — failed because the model wasn't supported on LiteLLM

### Session 3: s_1775288719531_13 (129 ops, DONE)
- **Task**: Heartbeat
- **Duration**: 376 minutes (~6.3 hours)
- **Cost**: $12.14 (3.9M input tokens)
- **LLM turns**: 149
- **Avg input/turn**: 25,865 tokens
- **Restarts**: 12 (13 segments, 6 with ops)
- **Status**: done

| Category | Count | % |
|----------|-------|---|
| other-bash | 119 | 72.6% |
| agents | 14 | 8.5% |
| file-inspect | 10 | 6.1% |
| read | 8 | 4.9% |
| finish | 7 | 4.3% |
| discovery | 3 | 1.8% |
| checkpoint | 2 | 1.2% |
| write | 1 | 0.6% |

**Productive**: 24 (14.6%) — **Exploratory**: 21 (12.8%) — **Other**: 119 (72.6%)

The 72.6% "other-bash" breaks down to:
- **Model investigation**: 69 ops (debugging LiteLLM model availability)
- **Session failure investigation**: 20 ops (diagnosing stuck/crashed sessions)
- **KB investigation**: 9 ops (Karpathy/knowledge base exploration)
- **Agent investigation**: 7 ops
- **DB investigation**: 6 ops

This session was essentially **an unplanned investigation** that spiraled across 12 restarts. The coach kept waking up, trying to figure out what was going on with model failures and session crashes, and getting restarted.

### Comparison: Typical 35-Op Session
- **Cost**: $1.62 (vs $12.14-$12.34 for high-op)
- **LLM turns**: 41 (vs 149-211)
- **Avg input/turn**: 11,918 tokens (vs 18K-26K)
- **Restarts**: 0
- **Distribution**: discovery 10, inspect 12, bash 13, read 7, write 2, edit 1, gym 1, agents 1

## Root Cause Analysis

### Primary Driver: Process Restarts (~60% of bloat)
Both extreme sessions had 6-12 restarts. Each restart:
1. Adds a new system message ("Process restarted")
2. Forces the agent to re-read context (checkpoint, heartbeat, journal)
3. Grows the conversation history (monotonically increasing input tokens)
4. Loses momentum on whatever task was in progress

The 184-op session's max input tokens hit 50,589/turn — the conversation history alone was consuming massive token budget by the later segments.

### Secondary Driver: Multi-Task Scope (~25% of bloat)
The 184-op session tried to do 4 different tasks:
1. EXP-216 regression awareness skill
2. Wrong-tool-args scenarios  
3. Skill A/B testing
4. EXP-025 workflow scenario sweep

Each task required its own discovery phase (find scenarios, read configs, check baselines). No state was shared between tasks.

### Tertiary Driver: Gym Run Proliferation (~15% of bloat)
41 gym-related ops in the 184-op session. Many were sequential with slight variations:
```
[93] gym-run hasty-fix (baseline)
[94] gym-run silent-dependency (baseline)
[103] gym-run sycophants-dilemma (baseline)
[107] gym-run sycophants-dilemma-workflow (variant)
[108] gym-run sycophants-dilemma-workflow-strict (variant)
[117] gym-run sycophants-dilemma-nudge (treatment)
[118] gym-run sycophants-dilemma-nudge (treatment 2)
[119] gym-run sycophants-dilemma-workflow-strict (treatment 2)
[120] gym-run sycophants-dilemma-workflow (treatment 2)
```

A batch runner could have replaced 10+ individual calls with 1.

## Which Prior Finding Fixes Would Have Helped?

From `finding-coach-session-efficiency-0410.md`, 5 fixes were proposed:

| Fix | Would It Help? | Estimated Impact |
|-----|---------------|-----------------|
| **1. State Index** | ✅ YES — each restart triggers fresh discovery | Saves ~10 ops per restart × 6 restarts = ~60 ops |
| **2. Gym Batch Runner** | ✅ YES — 41 gym calls → ~5 batch calls | Saves ~36 ops |
| **3. Growth-Trigger Guards** | ❌ NO — these weren't growth-trigger sessions | N/A |
| **4. Fast Nothing-to-Do** | ❌ NO — these sessions had real work | N/A |
| **5. Read-then-Act Discipline** | ✅ PARTIAL — 20 exploration chains of ≥3 | Saves ~20-30 ops |

**Total estimated savings from prior fixes: ~96-126 ops** (would bring 184-op session down to ~58-88 ops).

## New Insights (Not in Prior Finding)

### 1. Session Restart Accumulation (NEW — biggest cost driver)
The infrastructure allows sessions to accumulate ops across restarts indefinitely. A session that restarts 6 times naturally accumulates 6× the ops of a single-life session. **This is an infrastructure issue, not an agent behavioral issue.**

**Fix**: Cap session lifetime (maxTurns or maxRestarts). After N restarts, close the session and let the next cron/heartbeat pick up the work. The checkpoint system already handles continuity.

### 2. Context Growth Tax (NEW)
Each restart grows the conversation by ~5-10K tokens (tool results accumulate). By restart 6, the input tokens per turn hit 50K. This is a **quadratic cost** — each additional turn costs more than the previous one.

**Fix**: Session truncation on restart (summarize prior segments before continuing). Or simply: close and start fresh.

### 3. Investigation Spirals (NEW — 129-op session specific)
The 129-op session spent 69 ops investigating model availability issues — something that's not the coach's job and couldn't be fixed by the coach. The agent lacked a "this is not my problem" escape hatch.

**Fix**: Heartbeat should include a "if you encounter infrastructure issues, report and exit immediately" guard. Investigation of infra issues should be escalated to may/optimizer, not done inline.

### 4. Multi-Task Sessions Create Multiplicative Discovery
When a session tries to do 4 tasks, it runs 4× the discovery. A session that does 1 task well is cheaper than one that does 4 tasks partially.

**Fix**: Already partially addressed by the 15-op heartbeat budget. But for dispatched work sessions (not heartbeats), the task itself should be scoped to one experiment, not a list of 4.

## Exploration Chain Analysis (184-op session)

| Chain Length | Count | Where |
|-------------|-------|-------|
| 15 | 2 | Ops 1-15 (initial discovery), ops 200-214 (late reading) |
| 11 | 1 | Ops 27-38 (scenario discovery) |
| 10 | 2 | Ops 16-26 (experiment discovery), ops 44-54 (gym setup) |
| 9 | 1 | Ops 83-92 (baseline hunting) |
| 8 | 2 | Ops 95-103, ops 123-131 |
| 7 | 1 | Ops 72-79 |
| 6 | 1 | Ops 178-184 |

**Total exploration chains ≥3**: 20 chains

The session opened with **15 consecutive discovery ops** before taking any productive action — reading heartbeat, journal, lab files, scenarios, experiments, baselines, LIBRARY.md. A state index would eliminate most of this.

## Cost Comparison

| Metric | 184-op Session | 129-op Session | Typical 35-op | Ratio (184 vs typical) |
|--------|---------------|----------------|---------------|----------------------|
| Tool calls | 229 | 164 | 47 | 4.9× |
| LLM turns | 211 | 149 | 41 | 5.1× |
| Cost | $12.34 | $12.14 | $1.62 | 7.6× |
| Duration | 386 min | 376 min | 23 min | 16.8× |
| Input tokens | 3.9M | 3.9M | 489K | 8.0× |
| Restarts | 6 | 12 | 0 | ∞ |
| Productive % | 31.4% | 14.6% | ~8.5% | — |

The 184-op session is 7.6× the cost of a typical session but does ~4× the productive work. The 129-op session is 7.5× the cost but produces only ~1.5× the productive work (most was investigation waste).

## Recommendations (Prioritized)

1. **Cap session restarts** (maxRestarts=3 or maxTurns=80) — prevents runaway accumulation. Estimated impact: eliminates all >100 op sessions.
2. **Scope dispatched tasks to single experiments** — don't send 4-item task lists to coach work sessions. One experiment per session.
3. **Infrastructure issue escape hatch** — heartbeat guard: "If you encounter model/infra errors, report to may and finish immediately. Don't investigate."
4. **State index** (from prior finding) — eliminates post-restart discovery spirals.
5. **Gym batch runner** (from prior finding) — reduces gym-heavy sessions by ~40%.

## Conclusion

The "166-op" coach sessions are an artifact of session restart accumulation, not single-context behavioral bloat. The most impactful fix is infrastructure-level (cap restarts/turns), not behavioral (text rules). Within individual segments, the prior finding's recommendations (state index, batch runner, read-then-act) remain valid and would reduce per-segment waste by ~30-50%.
