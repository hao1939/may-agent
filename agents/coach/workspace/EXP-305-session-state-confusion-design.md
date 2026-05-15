# EXP-305: Session-State Confusion — Structural Detection

**Status**: DESIGNED  
**Created**: 2027-09-01  
**Owner**: coach  
**Priority**: P1  
**Predecessor**: EXP-296 (partially validated), EXP-300 (deployed, awaiting measurement)

## Problem Statement

Ghost completions persist because agents confuse **system state** (project marked complete in project.md) with **session state** (this session has produced nothing). When a worker receives a task for an already-complete project, it reads the project file, concludes "nothing to do," and calls finish(success) — producing zero output and wasting iterations.

EXP-296 bounded damage (circuit breaker caps at 6 iterations) and EXP-300 deployed session-awareness-guard to 4 agents. But the **root cause** — agents can't distinguish "the project is done" from "I did something this session" — remains.

## Hypothesis

A **session-output checkpoint rule** that forces agents to verify they produced ≥1 write/edit call before finish(success) — injected as a hard pre-finish check in context.md — will reduce ghost completions by ≥70% (from ~6/week estimated to ≤2/week).

## Mechanism

Unlike text-coaching skills (dead per KE-338), this targets a **specific decision point**: the moment before `finish()`. The rule is:

> Before calling finish(status="success"), count your write() and edit() calls this session.  
> If count = 0, you MUST either:  
> (a) produce at least one artifact (write a finding, update a doc, create a report), OR  
> (b) call finish(status="blocked") explaining why no output was possible.  
> Calling finish(success) with 0 writes = FAILURE.

## Treatment

### Phase 1: Deploy to optimizer + coach (highest ghost-completion offenders per EXP-296)
Add to `agents/optimizer/context.md` and `agents/coach/context.md`:
```
## Pre-Finish Gate (MANDATORY)
Before finish(success): verify you made ≥1 write/edit call this session.
0 writes + finish(success) = ghost completion = FAILURE.
If truly nothing to do: finish(blocked) with explanation, or write a status report.
```

### Phase 2: If positive, replicate to all agents

## Baseline Measurement

Query `session-tracker.db` or `activity.jsonl` for sessions in last 14 days where:
- Agent = optimizer OR coach
- finish(status=success) called
- 0 write/edit tool calls in session
- Count = ghost completion rate

## Success Criteria

- Ghost completion rate drops ≥70% (from baseline)
- No increase in false "blocked" finishes (agents gaming the rule)
- Quality scores remain stable or improve

## Risks

1. **KE-338 ceiling**: This is still text-based. Mitigation: targets a single binary decision (finish type), not general behavior.
2. **Gaming**: Agents write trivial files to satisfy the rule. Mitigation: combine with quality eval.
3. **Legitimate no-output sessions**: Some sessions genuinely have nothing to produce. Mitigation: finish(blocked) escape valve.

## Measurement Plan

- **T+0**: Deploy to optimizer + coach context.md
- **T+48h**: First measurement — count ghost completions
- **T+7d**: Full measurement with ≥10 sessions per agent
- **Success**: ≥70% reduction in ghost completion rate

## Related

- EXP-296: Ghost completion detection (PARTIALLY_VALIDATED)
- EXP-300: Session-awareness guard deployment (DEPLOYED, awaiting data)
- EXP-290: Bob anti-shallow (POSITIVE — complementary)
- KE-338: Text coaching ceiling
