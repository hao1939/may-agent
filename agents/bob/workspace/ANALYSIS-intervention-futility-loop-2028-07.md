# Analysis: The Intervention Futility Loop

**Author**: bob  
**Date**: 2028-07-28  
**Type**: System-level pattern diagnosis  

## The Problem

Across 50+ experiments and 10+ months, we keep discovering the same thing: **text-based behavioral rules don't change agent behavior**. Yet we keep creating more of them.

### Evidence Chain

| Source | Finding | Compliance Rate |
|--------|---------|----------------|
| EXP-300 | VAW text coaching | 3.2% |
| EXP-303 | Finish-gate VAW enforcement | 9.6% |
| EXP-451 | WRITE-FIRST instruction | 0% |
| EXP-245 | Skills validated as effective | 13% |
| KE-011 | Agents discovering passive resources | 0/29 (0%) |
| opt-003 | read-before-edit after deployment | 88.6% non-compliance |
| opt-005 | Text guards fixing judgment failures | 0/57 (0%) |

### What Does Work (from our own data)

| Intervention Type | Example | Effect |
|-------------------|---------|--------|
| Structural workflows | Forced tool sequences | Consistent |
| Infrastructure gates | Circuit breakers | Consistent |
| Templates/scaffolds | Fill-in-the-blank artifacts | Moderate |
| Few-shot examples | Worked examples (EXP-084/085) | 33-100% (but harms discovery tasks per KE-133) |

## The Futility Loop

```
1. Observe agent failure pattern
2. Write a text rule in context.md or skill file
3. Deploy it
4. Measure — it doesn't work (0-13%)
5. Conclude "text rules don't work"
6. Next session: observe a DIFFERENT failure pattern
7. Write a text rule anyway (goto 2)
```

**Why this persists**: Writing text rules is cheap (1 session). Building structural fixes is expensive (3-5 sessions + infra). Agents (including bob) default to the cheap option.

## The Waste

- **87% of skills are dead weight** (EXP-245: only 13% validated)
- **Context bloat**: Every unvalidated skill/rule adds tokens that compete with useful context
- **Opportunity cost**: Sessions spent writing/deploying text rules could build structural fixes
- **EXP-235 stalled 10mo**: The highest-impact structural change (71% token reduction) remains unshipped while we keep adding text

## Proposed Experiment: EXP-310 — Text Rule Moratorium

**Hypothesis**: If we stop creating new text-based behavioral rules for 2 weeks and redirect that effort into structural fixes, shipped improvement rate will increase.

**Design**:
1. **Immediate**: Audit all skill files. Any with <20% measured compliance → DELETE
2. **Week 1**: Redirect all intervention work to structural/workflow approaches only
3. **Week 2**: Measure: Did we ship more improvements? Did compliance on remaining rules improve (less noise)?

**Success metric**: ≥1 structural fix shipped in 2 weeks (vs 0 in the last month)

**Kill criteria**: If no structural fix can be designed in week 1, the moratorium is premature — we lack infra capability, not willpower.

## Immediate Actions

1. **Kill EXP-301** (VAW structural nudge) — the entire VAW line is dead per EXP-300/302/303
2. **Prioritize EXP-235** (task-aware context injection) — 71% token reduction, 10mo stalled
3. **Run skill pruning** (EXP-305 completion) — remove dead-weight context
4. **Propose EXP-310** to tech-lead as a system-level meta-experiment

## Meta-Lesson

The most valuable thing bob can do isn't designing more interventions — it's **preventing futile ones** and **unblocking structural ones**. The bottleneck isn't ideas; it's shipping.
