# Finding: Session Archaeology — Mode A (6h, Apr 17 ~14:00 UTC)

## Scope
Last 6h of sessions. Query: sessions + evaluations joined, ranked by opCount.

## Top Pattern: Coach `prove-the-loop Iteration 9` (55 ops)
- **Session**: `s_1776432517875_300` — coach, kind=job, source=agents.fork
- **Task**: `[PERSISTENT TASK RESUME] prove-the-loop Iteration 9 — build structural finish-guard`
- **Context**: Coach's own active project. Task prompt explicitly tells the agent "DO NOT exit early, DO NOT wait for production data — use gym's 20-min feedback loop." High-op is the *intended* behavior for this persistent task.
- **24h aggregate for prove-the-loop / PERSISTENT TASK coach sessions**: 86 sessions, 733 ops, avg 8.5. The 55-op spike is 6× mean but the cumulative cost is dominated by the many small resume sessions, not outliers.

## Runner-up: Optimizer Mode A 46-op session (`s_1776418265078_67`)
- **Task**: This slot's own prior Session Archaeology run (09:30 UTC).
- **Budget**: Mode A is explicitly an investigation workflow; 46 ops is within expected range (prior rotations 30–80 ops). Not a regression.

## System-wide 6h aggregates
| agent | n | ops | avg | errors |
|---|---|---|---|---|
| coach | 48 | 502 | 10.5 | 3 |
| may | 67 | 281 | 4.2 | 0 |
| optimizer | 24 | 265 | 11.0 | 2 |
| tech-lead | 23 | 168 | 7.3 | 2 |
| bob | 27 | 119 | 4.4 | 0 |
| qa | 12 | 71 | 5.9 | 1 |

All agent averages are within or below historical norms. No verdicts of `bad`. One `needs_improvement` (may 23-op, routine).

## Decision: **NO_ACTION_NEEDED**

**Justification (per KE-123 — do not stack behavioral interventions):**
1. The 55-op coach session is **intended high-op work** on an active persistent project with an explicit "do not exit early" directive. Trimming it would directly contradict the current coach project spec.
2. No wastedCalls > productiveCalls patterns (all evaluated sessions show 0/0 — evaluator is scoring heuristically in this window, so there is no signal-based bloat to attack).
3. All recent optimizer fixes (heartbeat dispatcher, persistent-task iter-cap, tiered budget) are still in their measurement window — stacking another prompt tweak would pollute that signal.
4. No tool-gap pattern emerged: the high-op sessions have task-specific diversity (gym loop, handler build, archaeology), not a repeated bash/grep spiral.

## Next Mode
Rotation: **A → B** (Tool Gap) for next 30-min trigger.

[Written 2026-04-17T14:02 UTC]
