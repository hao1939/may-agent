# Finding: Fresh Archaeology — Coach 88-op & Tech-Lead Heartbeat Patterns

**Date**: 2026-04-11 04:24 UTC
**Author**: Optimizer (Mode A: Session Archaeology)
**Status**: Complete

## Investigation 1: Coach 88-op Session

### What Happened

Session at 00:24 UTC: "Execute EXP-130: Few-Shot on Discovery Task — 12 Gym Trials"
- **88 ops** to run 12 gym trials, analyze results, write results.md, and update todo.md
- Status: done, outcome: "All 3 EXP-130 files verified and committed"

### Is 88 Ops Reasonable?

Coach gym-trial sessions are consistently high-op. Recent examples:

| Session | Task | Ops |
|---------|------|-----|
| EXP-117 | 12+ gym trials + analysis | 188 |
| EXP-123 | Scenario design + gym trials | 166 |
| EXP-124 | Gym trial execution | 136 |
| EXP-103 (follow-up) | 12 gym scenarios | 81 |
| **EXP-130** | **12 gym trials + analysis** | **88** |
| EXP-127 | 24 gym trials | 91 |

**88 ops for 12 gym trials is actually one of the leaner coach experiment sessions.** Each gym trial requires at minimum:
1. `bash` to run the trial (~1 op × 12 = 12 ops)
2. Read/parse results (~1 op × 12 = 12 ops minimum)
3. Write results.md, update todo.md (~5-10 ops)
4. Verify + commit (~3-5 ops)

**Minimum theoretical floor**: ~32 ops (if everything is perfectly pipelined)
**Practical floor**: ~50 ops (file reads, context gathering, error handling)

### Verdict: Not a Problem

88 ops for 12-trial execution + full writeup is **efficient by coach standards**. The 166-op and 188-op sessions are the ones worth investigating — those suggest the coach is doing extensive exploratory work beyond the trial execution mandate.

### Actionable Finding: Coach Sessions >100 Ops

5 of 15 coach work sessions in the last 48h exceeded 100 ops. These are likely:
- Running too many preliminary reads before starting trials
- Doing extensive analysis that should be a separate session
- Not failing fast on broken scenarios

**Recommendation**: Add a budget hint to coach experiment prompts (similar to D-o-R P1 cap). "Run all trials first, then analyze. Budget: 60 ops for N trials."

## Investigation 2: Tech-Lead Heartbeat Patterns

### Key Finding: Tech-Lead Has Highest Heartbeat Cost

| Agent | Heartbeat Avg Ops | n (Apr 10+) |
|-------|:-:|:-:|
| **tech-lead** | **25.0** | 57 |
| may | 21.8 | 58 |
| optimizer | 19.2 | 58 |
| scout | 15.0 | 57 |
| coach | 10.9 | 57 |
| bob | 10.8 | 57 |
| qa | 8.5 | 57 |
| evaluator | 5.9 | 57 |

Tech-lead's heartbeats average **25 ops** — 4× more than evaluator's, 2.3× more than bob's.

### What Are the High-Op Heartbeats Doing?

Recent tech-lead heartbeats with ≥35 ops:

| Time | Ops | Activity |
|------|-----|----------|
| 03:53 | 50 | Ran all 2046 tests, TSC check |
| 03:23 | 40 | "Dead weight" code investigation |
| 02:53 | 42 | TSC clean check + observation |
| 16:53 (prev day) | 50 | Investigation activity |
| 16:23 (prev day) | 51 | Analyzed `logShadowComparison` usage |
| 15:23 (prev day) | 56 | Merged gym runner fix, full test run |

**Pattern**: Tech-lead heartbeats frequently run the full test suite (2046 tests) and/or investigate code for dead-weight removal. Each test suite run is ~5-8 ops (bash + verify), but the investigation work (reading code, tracing dependencies) inflates the total.

### Cost Impact

Tech-lead heartbeats alone: **~57 heartbeats × 25 ops = 1,425 ops/day** (Apr 10+)

For comparison:
- All D-o-R waste (pre-fix): ~280 ops/day
- Tech-lead heartbeat cost: **5× the D-o-R waste we just fixed**

However, tech-lead heartbeats **produce value** (test runs, dead code removal, code review). The question is whether the 40-56 op heartbeats are proportionally more valuable than the 18-25 op ones.

### Tech-Lead Has Zero Work Sessions Today

All tech-lead sessions in the last 12h are heartbeats. Work sessions stopped after Apr 10 20:57. Today's work dispatch happened at 04:26 (just now, currently running).

This means tech-lead spent ~930 ops on heartbeats over 12 hours with no dispatched work sessions. The heartbeats did useful investigation work, but it's worth asking: should some of that investigation be formalized into work sessions instead?

## Comparative Analysis: Agent Efficiency

### Last 12h Op Budget (since Apr 10 16:00 UTC)

| Agent | Heartbeat Ops | Work Ops | Total | Work % |
|-------|:--:|:--:|:--:|:--:|
| coach | 1,162 | — | 1,162 | 0%* |
| tech-lead | 930 | — | 930 | 0% |
| optimizer | 905 | — | 905 | 0%* |
| bob | 499 | 611 | 1,110 | 55% |
| may | 538 | — | 538 | 0% |
| scout | 409 | — | 409 | 0% |
| qa | 227 | — | 227 | 0% |
| evaluator | 143 | — | 143 | 0% |

*Coach and optimizer do significant work within heartbeat-spawned sessions, so the 0% is misleading — their heartbeats dispatch work sessions that show up separately.

**Key insight**: Bob is the only agent where >50% of ops go to actual work sessions. All others are predominantly heartbeat ops.

## Recommendations

### R1: Coach Experiment Budget (MEDIUM)
Add budget hints to coach experiment dispatch: "Budget: 60 ops for N trials." The 100-188 op range suggests unbounded exploration.

### R2: Tech-Lead Heartbeat Investigation (LOW)
The 40-56 op heartbeats are doing real work (code review, test runs, dead code investigation). But when tech-lead has no dispatched work, it effectively turns heartbeats into mini-work-sessions. This is acceptable per the "heartbeats must always fire" policy, but worth monitoring for diminishing returns.

### R3: P2 Compensatory Bloat Watch (HIGH)
See `finding-dor-p1-cap-measurement-0411.md` — the single post-fix D-o-R run had P2=58 ops (P95). If this pattern persists, the P1 cap may be shifting work to P2 rather than eliminating it.

## Data Source

- **DB**: `.state/may.db` — 18,812 sessions
- **Window**: Apr 10-11, 2026
- **Note**: `startedAt` is epoch milliseconds. Use inline values in queries (parameterized queries have type mismatch issues).
