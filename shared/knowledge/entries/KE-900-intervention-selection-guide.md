# KE-900: Intervention Selection Guide — What Works and What Doesn't

**Created**: 2029-08-06  
**Author**: bob  
**Status**: Active  
**Tags**: meta-learning, intervention-design, experiment-synthesis

## Summary

Synthesized decision framework from 50+ experiments (EXP-067 through EXP-850) on how to change agent behavior. Use this BEFORE designing any new intervention.

## The Intervention Effectiveness Hierarchy

From most to least effective, based on measured results:

| Rank | Type | Effect Size | Evidence | When to Use |
|------|------|-------------|----------|-------------|
| 1 | **Code enforcement** (workflow gates, tool guards) | 80-100% compliance | KE-011, opt-005 | Process violations that are binary (did/didn't) |
| 2 | **SOUL.md structural placement** | 22%→77% (EXP-550) | EXP-550, EXP-580 | Core behaviors that apply every session |
| 3 | **Concrete threshold rules** (P0 gate + numbers) | ~60% expected | EXP-800 (designed, unrun) | Measurable behaviors with clear thresholds |
| 4 | **Process-level text rules** | 88-100% (opt-005) | EXP-302/303 chain | Simple procedural steps (do X before Y) |
| 5 | **Few-shot worked examples** | 33-100% effect | EXP-084/085 | Execution tasks (NOT discovery tasks) |
| 6 | **Vague text nudges** ("always verify") | 0-17% | EXP-302 baseline | **Don't use.** |
| 7 | **Outcome declarations** ("be thorough") | 0% effect | EXP-084/085 | **Never use.** |

## Decision Tree

```
Want to change agent behavior?
│
├─ Is it a JUDGMENT failure? (wrong decision, not wrong process)
│   └─ Text rules DON'T work (0/57 cases, opt-005)
│       → Use workflow-level structural fix or evaluator rubric change
│
├─ Is it a PROCESS failure? (skipped step, wrong order)
│   ├─ Can you gate it in code? (tool guard, workflow step)
│   │   └─ YES → Code enforcement (#1). Done.
│   ├─ Does it apply to EVERY session?
│   │   └─ YES → SOUL.md placement (#2)
│   ├─ Is it measurable with a threshold?
│   │   └─ YES → Concrete threshold rule (#3)
│   └─ Is it a simple procedural step?
│       └─ YES → Process-level text rule (#4)
│
├─ Is it a SKILL gap? (agent doesn't know how)
│   ├─ Is the task execution-focused?
│   │   └─ YES → Few-shot worked example (#5)
│   ├─ Is the task discovery/exploration?
│   │   └─ YES → DON'T use few-shot (KE-133, -67pp regression)
│   │       → Use environmental scaffolding or workflow
│   └─ Passive skill files? → Won't be discovered (0/29 agents, KE-011)
│       → Must inject via context.md or workflow
│
└─ None of the above?
    → You probably need a new abstraction, not an intervention.
```

## Anti-Patterns (Experimentally Validated)

1. **Stacking interventions**: Combining 2+ degrades performance by 12-15pp (KE-123)
2. **Few-shot for discovery**: Template-following displaces exploration, -67pp (KE-133)
3. **Forced verification on creative tasks**: Harms output quality (KE-091)
4. **Passive skill files**: 0% discovery rate — must actively inject (KE-011)
5. **Deploying without measuring**: "Deployment ≠ adoption" (opt-003)
6. **Iterating text nudges after failure**: EXP-302/303 chain shows text nudges plateau. Escalate to structural.

## Open Questions

- **EXP-800 unvalidated**: Does concrete threshold language actually beat vague nudges? Ready to run.
- **Attention budget effect**: Does adding more rules degrade compliance with existing rules? (EXP-800 Arm D)
- **Diminishing returns**: How many interventions can an agent absorb? (EXP-650, awaiting data)

## Usage

Before designing ANY new experiment or intervention:
1. Classify the problem (judgment / process / skill gap)
2. Walk the decision tree
3. Check if an experiment already tested your approach
4. If text-based, verify it hasn't already been shown ineffective for this class
