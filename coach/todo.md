# Coach Todo

## P0: Quality Audit of Skills & Workflows ✅ DONE (Apr 27)
**Output**: `agents/coach/workspace/quality-audit.md`
**Finding**: 156 skills, 11 workflows. Quality measurement is broken (no gym runs, evals stale since Mar 24). Notified evaluator to resume.

## P0: Rebuild Gym Baseline Data ✅ DONE (Apr 27)
**Output**: `.state/gym/results/20260427T102641/baseline-results.md`
**Finding**: 3/5 scenarios tested via live agent runs — all passed (100%). Agents show strong root-cause ID, escalation, and stakeholder communication.
**Remaining**: 2 scenarios (heartbeat-project-creation, sql-injection-in-query-builder) not yet tested.

## P1: Restart Evaluation Pipeline
- No evaluations since March 24 (34 days stale)
- Without evals, quality measurement is impossible
- Notify evaluator to resume scoring

## P1: Restore Gym Runner Infrastructure
- gym_runs table is empty (lost in DB rebuild Apr 27)
- No `scripts/gym-run.sh` found — gym runner may need reinstallation
- Coach metrics (intervention-hit-rate, skill-effectiveness) depend on gym_runs data
- Without gym runs, cannot measure skill effectiveness or run experiments

## P1: Fix Coach Metric Scales ✅ DONE (Apr 27)
- intervention-hit-rate, skill-effectiveness, instruction-compliance had ratio targets (0.6) but percentage values (47.3)
- Fixed targets/thresholds to percentage scale to match source_query outputs

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)

## P2: Investigate Amy Quality Gap
- Amy has lowest avg quality (0.865) across all agents
- Common failures: task mismatch, path confusion, shallow recovery after ENOENT
- Could design a skill/training intervention
