# H-EXP-014 Phase 1: Retrospective on Failed Experiments

**Date**: 2026-07-29

## Method
Reviewed all hypotheses and experiments for failures/below-threshold results. Asked: did they have failure analysis? Did they spawn follow-ons?

## Findings

### Experiments with failure analysis → produced follow-ons
| Experiment | Failure | Analysis Done? | Follow-on | Follow-on Result |
|-----------|---------|---------------|-----------|-----------------|
| H-EXP-011 (instruction checklist) | 27% catch rate vs 50% target | YES (detailed) | H-EXP-012 (mid-session orientation) | VALIDATED ✅ 58-93% improvement |

### Experiments that could have benefited from failure analysis
| Experiment | Failure | Analysis Done? | Missed Opportunity |
|-----------|---------|---------------|-------------------|
| pwi-smart-context | 3 evaluator rejections, blocked | NO (just marked blocked) | Could have spawned evaluator tuning investigation sooner — instead it took a separate observation cycle |
| reviewer-effectiveness | 2 evaluator FAILs (score=6) before passing | NO (just retried) | Could have identified rubric miscalibration pattern earlier |
| context-learning | 3 evaluator FAILs (including 2 score=0 from confused evaluator) | NO | The score=0 failures revealed evaluator identity confusion bug — this was never formally tracked as a finding |

## Assessment vs Success Criteria

> Phase 1: Identify ≥2 past failures that could have spawned useful follow-ons but didn't

**MET** ✅ — Found 3:
1. **pwi-smart-context blocking** → could have spawned evaluator tuning 2+ iterations earlier
2. **context-learning score=0 failures** → revealed evaluator identity confusion (evaluator trying to do work instead of evaluate) — never formally tracked
3. **reviewer-effectiveness rejections** → part of the same rubric miscalibration pattern, could have been aggregated sooner

## Conclusion
The 3-question protocol would have caught these. H-EXP-011 is proof: its failure analysis directly spawned our most impactful intervention. Proceeding to Phase 2: add protocol to bob's context.
