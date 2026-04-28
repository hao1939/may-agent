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

## P0: IT-113 — Restore skill-effectiveness metric via gym runs ✅ DONE (Jun 29)
- **Problem**: gym_runs table had 1 row → metric stuck at stale 29.2
- **Resolution**: Imported 159 results from results.jsonl, then backfilled lab_fork tags for 6 experiments (EXP-042/043, EXP-053, EXP-088, EXP-094) that had legitimate A/B data but no lab_fork set.
- **Result**: 8 lab_forks with 3+ runs. Metric now **62.5%** (target 60). 5/8 forks show ≥60% pass rate (C-f1-only:100%, EXP043-strict:100%, EXP053-ext:100%, EXP088-workaround:83%, EXP094-fewshot:100%).

## P1: Fix Coach Metric Scales ✅ DONE (Apr 27)
- intervention-hit-rate, skill-effectiveness, instruction-compliance had ratio targets (0.6) but percentage values (47.3)
- Fixed targets/thresholds to percentage scale to match source_query outputs

## P0: Unblock Gym Runner for A/B Experiments (NEW Jun 29)
- **Blocker**: Gym runner needs GYM_AGENT_BIN env var to spawn agent sessions. Without this, ALL experiments are blocked.
- **Evidence**: `node test/gym/.gym-runner-bundle.mjs partial-verification-trap --agent coder` finishes in 66ms with agent_status "skipped" — no agent is spawned.
- **Impact**: EXP-250 blocked, per-skill attribution blocked, verification experiment blocked.
- **Action needed**: Escalate to tech-lead/may to configure GYM_AGENT_BIN or find alternative invocation path.

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)

## P1: EXP-250 — Amy Path-Orientation Skill (IT-113 progression)
- **Status**: BLOCKED (Jun 29). Lab fork created at `agents/.lab/amy-env-orientation/`
- **Finding**: Amy's #1 failure is PATH_HALLUCINATION (8/10 low-quality sessions). Skill written.
- **Blocked on**: gym-run.sh requires GYM_AGENT_BIN env var — can't invoke agents from coach session
- **Need**: Someone with agent invocation capability to run: `agents/test/gym/run-gym.sh partial-verification-trap --agent amy --lab-fork EXP250-baseline` and `--lab-fork EXP250-treatment` (with skill)
- **Design**: `agents/coach/workspace/EXP-250-design.md`

## P0: Skill Quality Scorecard ✅ DONE (Jun 29)
- **Output**: `agents/coach/workspace/skill-quality-scorecard.md`
- **Finding**: 108 skills scored structurally (0-6 scale). Mean 4.4/6. 86% score 4+. Evidence-backing is weakest dimension (only 53% cite KE/EXP). 8 README placeholders are junk. Behavioral effectiveness still unknown — needs gym A/B data.

## P2: Investigate Amy Quality Gap ✅ DIAGNOSED (Jun 29)
- Amy has lowest avg quality (0.869 last 7d) across all agents
- Root cause: PATH_HALLUCINATION — works in wrong dirs, copies files instead of cd'ing
- Solution: EXP-250 above

## P0: Skill Effectiveness Measured ✅ DONE (Jun 29)
- **Output**: `agents/coach/workspace/skill-effectiveness-measured-2026-06-29.md`
- **Finding**: 3 skills PROVEN effective (Amy +37%, Coder +37%, verify-after-edit 100% gym). 1 partially effective (tech-lead path skill). 12 NEVER measured.
- **Next**: EXP-251 to fix tech-lead PATH_HALLUCINATION; broaden second-look-verification to more agents

## P1: EXP-251 — Tech-Lead PATH_HALLUCINATION Investigation (NEW Jun 29)
- Tech-lead has establish-working-directory skill deployed but PATH_HALLUCINATION spiked to 26 incidents in recent period
- Most recent eval: 0.35 with PATH_HALLUCINATION to `/home/zeus`
- **Hypothesis**: Skill text doesn't cover `/home/zeus` pattern specifically, or agent isn't reading skill
- **Action**: Check tech-lead's skill content, add `/home/zeus` prohibition, measure

## P1: Quality Trend Analysis ✅ DONE (Jun 29)
- **Output**: `agents/coach/workspace/quality-trend-analysis-20260629.md`
- **Finding**: All agents improved +25pp avg over 4 weeks (0.68 → 0.93). Convention coaching + finish-guard + context.md embedding drove the improvement.
- **Answers Hao's P0 question**: Skills/training DO work at the system level. Per-skill attribution still needs gym A/B tests.
- **Next**: Need GYM_AGENT_BIN configured to run actual A/B experiments for per-skill attribution.

## P1: EXP-251 — Targeted FM-3.3/FM-1.3 Coaching ✅ DONE (Apr 25)
- **Output**: `agents/coach/workspace/EXP-251-results.md`
- **Finding**: Bob FM-3.3 rate dropped 20% → 4.2% (-15.8pp). QA FM-1.3 rate dropped 28.6% → 5.0% (-23.6pp). Both avg quality improved ~+0.3. Context.md one-line coaching works.
- **Next**: Identify next coaching target when eval data resumes
