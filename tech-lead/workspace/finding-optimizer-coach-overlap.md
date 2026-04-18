# Finding: Optimizer / Coach Overlap Analysis

**Date**: 2026-04-18  
**Lens**: A (System Architecture)  
**Severity**: Low — partial overlap exists but roles are sufficiently distinct  

## Summary

Optimizer and Coach both analyze agent performance but serve different purposes with different outputs. They should NOT be merged. The overlap is in their *input* (session data, error patterns) not their *output* (tools/workflows vs skills/gym experiments).

## Evidence

### Role Differentiation

| Dimension | Optimizer | Coach |
|-----------|-----------|-------|
| **Purpose** | "Make agents better by discovering and building better tools, skills, and workflows" (`agents/optimizer/heartbeat.md:3`) | "Prove which skills actually improve agent behavior" (`agents/coach/heartbeat.md:3`) |
| **Work modes** | Session Archaeology, Tool Gap Analysis, Skill Scouting, Workflow Health (`agents/optimizer/heartbeat.md:~80-84`) | Growth cycles, training sprints, gym scenarios, convention regression (`agents/coach/heartbeat.md:~110-120`) |
| **Primary output** | Tools, workflow improvements, automation | Skills, gym experiment results (EXP-XXX), intervention measurements |
| **Method** | Build & ship (`workflow.run('implement-and-verify')` — `agents/optimizer/heartbeat.md:~60`) | Measure & prove (`workflow.run('growth-cycle')` — `agents/coach/heartbeat.md:~95`) |

### Session Activity (last 24h from DB query)

- **Optimizer**: 10 sessions, mostly heartbeats (1-2 ops each). Low activity — primarily dispatching.
- **Coach**: 10 sessions including substantive work: `use-persistent-task` structural intervention experiment (22 ops, 51 ops), coaching-feedback convention analysis, common-sense-verify (14 ops), reflection. Much more active.

### Overlap Area

Both agents' heartbeats run the same "observe" query pattern — `SELECT agent, COUNT(*), AVG(opCount), errors FROM sessions` (`agents/optimizer/heartbeat.md:~20`, `agents/coach/heartbeat.md:~30`). Both read session data to find problems. But they diverge at the "act" step:

- **Optimizer** → "Mode C: Skill & Technique Scouting" overlaps with Coach's domain (`agents/optimizer/heartbeat.md:~83`). This is the one real overlap — optimizer scouts for skill ideas that coach should be testing.
- **Coach** → never builds tools or workflows, stays in the experiment/measurement lane.

## Recommendation

**Do not merge.** The roles are complementary: optimizer discovers opportunities and builds solutions, coach validates behavioral changes rigorously. 

**Minor cleanup opportunity**: Optimizer's "Mode C: Skill & Technique Scouting" could be eliminated or redirected to notify coach instead of acting independently. This would sharpen the boundary. File as a separate task if desired.
