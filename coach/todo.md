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

## P0: IT-113 — Restore skill-effectiveness metric via gym runs
- **Status**: IN PROGRESS (Jun 28)
- **Problem**: gym_runs table has 0 rows → metric stuck at stale 29.2 (target 60)
- **Root cause**: Data lost in DB rebuild Apr 27. Runner EXISTS at `agents/test/gym/run-gym.sh` (NOT scripts/gym-run.sh)
- **Plan**:
  1. Run 5 core scenarios with lab forks (skills vs baseline) to seed gym_runs
  2. Pick top 3 deployed skills: verify-after-edit, evidence-over-narrative, consolidate-memory
  3. Create lab forks with each skill, run against matching scenarios, measure pass rates
  4. If pass rates populate correctly, metric should self-heal on next snapshot
- **Next step**: Growth cycle created `coder-verify-gate` fork but escalated before gym test. Need to re-run growth-cycle or run gym tests manually via workflow. The gym runner ONLY does dry evaluation checks — it does NOT launch agent sessions. Real data requires the full workflow pipeline.
- **BLOCKER**: gym-run.sh is a check-only tool. Populating gym_runs requires growth-cycle workflow to complete successfully (it launches real agent sessions internally). The growth cycle escalated because it expected a `context-patch.md` file but the fork used a different structure.
- **Done-when**: gym_runs has ≥15 rows AND skill-effectiveness metric recalculates above 40%

## P1: Fix Coach Metric Scales ✅ DONE (Apr 27)
- intervention-hit-rate, skill-effectiveness, instruction-compliance had ratio targets (0.6) but percentage values (47.3)
- Fixed targets/thresholds to percentage scale to match source_query outputs

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)

## P2: Investigate Amy Quality Gap
- Amy has lowest avg quality (0.865) across all agents
- Common failures: task mismatch, path confusion, shallow recovery after ENOENT
- Could design a skill/training intervention
