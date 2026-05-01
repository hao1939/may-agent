# EXP-291: Anti-Shallow Replication to Remaining Agents

**Status**: DEPLOYED (2026-05-01)
**Created**: 2026-05-01
**Target agents**: amy, coder, tech-lead
**Hypothesis**: Anti-shallow rule (≥10 tool calls before finish) will improve quality scores for agents not yet treated, replicating EXP-290's +32pp result on bob.

## Background

EXP-290 showed anti-shallow enforcement in bob/context.md eliminated shallow sessions (69% → 0%) and raised quality from 0.349 to 0.671 (+32pp). The rule was replicated to coach, scout, qa, may. Remaining agents without it: amy, coder, tech-lead, optimizer (has C15.1 equivalent), evaluator, architect, judge, master.

## Target Selection

Prioritizing agents that:
1. Run work sessions (not just heartbeats)
2. Don't already have equivalent rules
3. Have measurable output

**Selected**: amy, coder, tech-lead

## Treatment

Add to each agent's context.md:

```
## ⛔ ANTI-SHALLOW RULE (P0)
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true. If your task seems done, verify your work with reads/greps.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Measurement Plan

1. **Baseline**: Grep evaluator activity.jsonl for quality scores of target agents in 7 days pre-deployment
2. **Deploy**: Add rule to context.md for each agent
3. **Post-measure**: Same grep 7 days post-deployment
4. **Success**: ≥15pp improvement in average quality score

## Risks

- KE-338: Text coaching is dead for most behavioral changes. BUT anti-shallow is the exception (proven in EXP-290, 270).
- context.md is universally loaded (confirmed), so the rule WILL be seen.
- Risk: agents already above baseline won't show improvement.

## Next Steps

1. Establish baseline quality for amy, coder, tech-lead from available evaluator data
2. Deploy treatment to all 3 simultaneously
3. Measure after 7 days

## Decision Gate

If no evaluator data available for baseline within 48h, proceed with deployment anyway (treatment is harmless) and measure only post-deployment trajectory.
