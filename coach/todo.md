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
- **Status**: PARTIAL (Jun 29)
- **Problem**: gym_runs table had 1 row → metric stuck at stale 29.2
- **Progress (Jun 29)**: Imported 159 results from results.jsonl → gym_runs now has 160 rows. Metric recalculated to **50%** (up from 29.2). Only 2 lab_forks have >=3 runs (C-f1-only: 100%, D-baseline: 0%).
- **Remaining gap**: Need more A/B experiments with lab_fork tags to reach target of 60%. Current data is mostly scenario-level (no fork comparison). Need 2-3 more skill-vs-baseline experiments where the skill fork hits >=60%.
- **Next step**: Design EXP-250: pick 2 high-value skills (e.g. verify-after-edit, evidence-over-narrative), create lab forks, run 5+ trials each against appropriate scenarios.
- **Done-when**: ≥5 lab_forks with 3+ runs each AND metric ≥60%

## P1: Fix Coach Metric Scales ✅ DONE (Apr 27)
- intervention-hit-rate, skill-effectiveness, instruction-compliance had ratio targets (0.6) but percentage values (47.3)
- Fixed targets/thresholds to percentage scale to match source_query outputs

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)

## P1: EXP-250 — Amy Path-Orientation Skill (IT-113 progression)
- **Status**: DESIGNED (Jun 29). Lab fork created at `agents/.lab/amy-env-orientation/`
- **Finding**: Amy's #1 failure is PATH_HALLUCINATION (8/10 low-quality sessions). Skill written.
- **Next**: Need bob to run gym trials: `partial-verification-trap` + `read-before-edit` with lab_fork tag
- **Blocked on**: gym-run.sh requires live agent invocation (can't execute in coach session)
- **Design**: `agents/coach/workspace/EXP-250-design.md`

## P2: Investigate Amy Quality Gap ✅ DIAGNOSED (Jun 29)
- Amy has lowest avg quality (0.869 last 7d) across all agents
- Root cause: PATH_HALLUCINATION — works in wrong dirs, copies files instead of cd'ing
- Solution: EXP-250 above
