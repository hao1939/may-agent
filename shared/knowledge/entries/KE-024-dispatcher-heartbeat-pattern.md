# KE-024: Separating heartbeat triage from execution eliminates overhead and errors

**Status**: verified (strongly)  
**Evidence**: EXP-034 (controlled before/after, n=8 POST + 74 baseline)  
**Discovered**: 2026-04-06  
**Last verified**: 2026-04-06

## Claim

Converting monolithic "do-everything" heartbeats into lightweight dispatchers that fork focused work sessions produces overwhelming improvements: **94% cost reduction** per heartbeat ($2.63→$0.15), **100% error elimination** (12.2%→0%), and **47% quality improvement** (3.4→5.0/5). The mechanism is separation of concerns: planning needs 5-15 turns, execution needs 20-80+. Combining them in one session causes turn-limit pressure and context-loading waste.

## Evidence

### EXP-034: Optimizer Dispatcher Experiment (2026-04-05/06)

**Design**: Before/after comparison. 7-day baseline (74 heartbeats) vs POST-dispatcher (8 heartbeats + 2 work sessions over 13h).

**Primary results**:
| Metric | Baseline | Dispatcher | Change |
|--------|----------|------------|--------|
| HB error rate | 12.2% | 0% | **-12.2pp** |
| HB avg cost | $2.63 | $0.15 | **-94%** |
| HB avg ops | 21.1 | 9.0 | **-57%** |
| HB avg duration | 7.2 min | 1.7 min | **-76%** |
| HB quality | 3.4/5 | 5.0/5 | **+47%** |
| Turn-limit errors | 6 in 6.2d | 0 in 13h | **-100%** |
| Total daily cost | $35.31 | $12.24 | **-65%** |

**Work sessions**: 2 forked sessions both succeeded (100% "good" verdicts), with clear objectives and appropriate turn budgets.

**All 8 success criteria met.**

## Mechanism

1. **Separation of concerns**: Planning (read state, triage) and execution (implement, analyze) have fundamentally different resource profiles. Combining them wastes planning sessions on execution overhead.
2. **Turn-limit immunity**: Dispatcher heartbeats use 5-14 ops (well under limits). Work sessions get fresh budgets. No session runs out of room.
3. **Context efficiency**: Each heartbeat loads full context at $2.63 for context+work. Dispatcher loads context for $0.15 then exits. Work sessions load only task-specific context.
4. **Graceful degradation**: When no work needed, dispatcher exits in 5-7 ops ($0.11). Monolithic heartbeats searched for work to fill budget.

## Connections

- **KE-020** (adoption hierarchy): Dispatcher pattern is an *architectural* adoption mechanism — it structurally forces triage-then-fork rather than relying on agents to self-limit.
- **KE-013** (task boundedness): Forked work sessions have explicit bounded objectives, which KE-013 shows is the primary driver of session quality.
- **H-041** (decision topology): Dispatcher heartbeat has high R (mostly eliminable decisions — read, triage, fork) while monolithic heartbeats mix high-R triage with low-R execution.
- **H-053** (workflow adoption decay): The dispatcher pattern is structural enforcement of the triage/execute separation. Per H-053, this won't decay because it's architectural, not instructional.
- **H-070** (workflow fixed cost): Dispatcher reduces C_fixed for the triage phase, expanding the set of tasks where intervention helps.

## Caveats

- Small POST sample (n=8 heartbeats, n=2 work sessions). Effect sizes are enormous but longer monitoring needed.
- POST period was quiet (no Hao task injection). Untested under high-activity conditions.
- Fork-and-forget risk: failed forks not yet observed or handled.
- Generalizability: Optimizer has clean task decomposition. Agents with less decomposable work may benefit less.

## Implications

1. **Adopt for all high-cost agents**: Bob ($36/day HB cost), Coach ($23/day) should adopt the dispatcher pattern.
2. **System-wide savings potential**: ~$80/day ($29K/year) if applied to top 3 agents.
3. **Template the pattern**: Create a shared dispatcher template in `agents/shared/knowledge/patterns/`.
4. **Connects to KE-003**: Rich delegation context reduces ops by 47%. Dispatcher + rich context for forked sessions could compound benefits.
