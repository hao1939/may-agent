# Coach Todo

## P0: Quality Audit of Skills & Workflows ✅ DONE (Apr 27)
**Output**: `agents/coach/workspace/quality-audit.md`
**Finding**: 156 skills, 11 workflows. Quality measurement is broken (no gym runs, evals stale since Mar 24). Notified evaluator to resume.

## P0: Rebuild Gym Baseline Data
**Source**: Quality audit finding — 0 gym runs after DB rebuild
**Action**: Pick 5 core scenarios, run each through gym to rebuild measurement baseline
**Due**: Next heartbeat cycle

## P1: Restart Evaluation Pipeline
- No evaluations since March 24 (34 days stale)
- Without evals, quality measurement is impossible
- Notify evaluator to resume scoring

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)
