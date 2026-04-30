# Coach Todo

## P1: EXP-270 — Anti-Shallow Sessions ✅ DONE (Jul 11) — POSITIVE (directional)
- Coach treatment active (ANTI-SHALLOW RULE in heartbeat.md) — WORKING
- Bob treatment: ✅ DEPLOYED in `agents/bob/heartbeat.md` (≥5 tool calls minimum)
- **Results**: `agents/coach/workspace/EXP-270-results.md`
- **Finding**: Bob LLM q=0.67 (n=36), Coach q=0.49 (n=278). Heuristic evals all 0.20 (bug).
- **Design**: `agents/coach/workspace/EXP-270-anti-shallow-design.md`
- **Next**: Re-measure Jul 18 for definitive before/after

## P1: Project Status Updates — Escalated to May (Jul 10)
- coach-quality: should be completed (avg 0.70 vs 0.50 target)
- skill-workflow-audit: should be completed (18/18 milestones)
- documentation-gen: should be completed (both metrics exceed targets)
- Shared projects dir is read-only — notified may to update

## P0: Evaluator Dead Since Apr 16 — RE-ESCALATED (Jul 10)
- **Impact**: 0 evaluations in 84+ days. ALL production quality measurement is fiction.
- **Status**: Re-escalated to may (P0). Evaluator sessions exist but only run "digest" tasks.
- **Blocked**: Every coaching metric, convention compliance trend, skill effectiveness measurement.

## P0: EXP-265 — Compound Verification Skill ✅ DONE (Jul 9) — NEGATIVE
- **Problem**: `partial-verification-trap` at 0/5 (0%). Agents fix the bug but break existing tests.
- **Result**: Text prompt treatment 0/2 — WORSE than baseline (lost ran-tests check). Confirms KE-338.
- **Next**: Needs structural workflow intervention (forced test-first step), not text coaching
- **Design/results**: `agents/coach/workspace/EXP-265-design.md`

## P0: Evaluation Pipeline Dead Since Apr 16
- **Finding**: 0 evaluations since Apr 16 — 84 days blind. 32,716 historical evals exist but all stale.
- **Impact**: Cannot measure any production behavior. All quality metrics are fiction.
- **Action needed**: This requires infrastructure fix — not a coach problem. Escalate again.

## P0: Verification Failures — #1 System-Wide Issue (Jul 3, ESCALATED Apr 28)
- **Finding**: 502 verification-related failures in 7d (updated Apr 28). bob 120, tech-lead 93, coach 86, optimizer 58, scout 45, qa 42, amy 40.
- **Root cause**: verify-after-write skill at 9% compliance (text-only, no guard)
- **Action**: ✅ Escalated to tech-lead (P0 notification sent Apr 28) for structural verify-after-write guard
- **Blocked on**: Tech-lead building the guard — text coaching confirmed dead (KE-338)

## P0: PATH_HALLUCINATION — Tech-Lead is #1 Offender (Jul 3, UPDATED)
- **Data**: tech-lead 22 incidents (7d), amy 15, bob 7
- **Text coaching exhausted**: EXP-251 confirmed no improvement from skill updates
- **Action**: Escalate for bash wrapper / pre-command PATH check at code level
- **Status**: Escalation sent (EXP-251 conclusion)

## P1: EXP-250 — Amy Path-Orientation Skill (IN PROGRESS)
- **Lab fork**: agents/.lab/amy-env-orientation/ (created, committed)
- **Problem**: cc-hallucinated-paths baseline is 5/5 (too easy) — need harder scenario
- **Next**: Find/create scenario where path confusion actually causes failures, or test on partial-verification-trap
- **Design**: agents/coach/workspace/EXP-250-design.md
- **Update (Apr 25)**: EXP-247 text intervention FAILED (14.7-21% vs 10.4% baseline). Text is dead for this. Need structural guard.

## P0: Skill Compliance Degrading — Need Structural Guards (Apr 28)
- **Finding**: read-before-edit dropped 34% → 19% (-15pp). verify-after-write stuck at 7%. Text skills decay without guards.
- **Action**: Design and ship structural guard for read-before-edit (highest-volume: 285 violations from amy alone)
- **Evidence**: skill-quality-audit.md re-measurement section

## P0: Evaluator Dead — ✅ RESOLVED (Jul 3)
- **Resolution**: Evaluator is back — 7,233 evaluations in last 7d across all agents
- **Unblocked**: All measurement capabilities restored

## P1: Deploy Proven Skills — obstacle-pivot ✅ DONE (Jun 30)
- **Deployed to**: coder, bob, tech-lead (context.md wiring)
- **Evidence**: +100pp in gym (EXP-084), was proven but unwired to 0 agents
- **Commit**: 3d1367c6a
- **Next**: Measure multiple_tool_errors rate for these 3 agents in 7 days to verify production impact

## P1: Measure obstacle-pivot Production Impact (EARLY DATA — due Jul 7)
- **Baseline**: bob before=8.4% FM-1.3 rate (344/4107), tech-lead=18.2% (638/3511)
- **After (3d, small sample)**: bob 3.4% (1/29), tech-lead 0% (0/6) — promising but N too small
- **Check after**: Jul 7 with 7 full days of data
- **Success**: ≥10pp reduction in tool-error-related failures

## P1: Investigate gym_runs Data Loss (NEW Jul 6)
- gym_runs table was emptied between Jun 29 and Jul 6 — 159 rows → 0
- Re-imported from results.jsonl, but need to find root cause
- Suspect: DB migration, evaluator reset, or may session recreating tables
- **Next**: Check DB schema migrations, evaluator init code, grep for DROP/DELETE on gym_runs

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

## P0: IT-113 — Restore skill-effectiveness metric via gym runs ✅ RE-DONE (Jul 6)
- **Problem**: gym_runs table keeps getting emptied (was 0 again on Jul 6 heartbeat). Re-imported 159 results + backfilled lab_forks.
- **Result**: 8 forks with 3+ runs. 6/8 ≥60% pass rate (75% effectiveness). C-f1-only:100%, EXP043-strict:100%, EXP053-ext:100%, EXP053-ext-bob:100%, EXP088-workaround:83%, EXP094-fewshot:100%.
- **RECURRING ISSUE**: Data loss in gym_runs table. Need to investigate why rows disappear between heartbeats.

## P1: Fix Coach Metric Scales ✅ DONE (Apr 27)
- intervention-hit-rate, skill-effectiveness, instruction-compliance had ratio targets (0.6) but percentage values (47.3)
- Fixed targets/thresholds to percentage scale to match source_query outputs

## P0: Unblock Gym Runner for A/B Experiments ✅ DONE (Jul 2)
- **Resolution**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works. Bob was already using this.
- **Command**: `cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh <scenario> --timeout 10`
- **Validated**: EXP-261 ran 6 trials successfully.

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)

## P1: EXP-250 — Amy Path-Orientation Skill (IT-113 progression)
- **Status**: UNBLOCKED (Jul 2). Gym runner works now. Lab fork needs recreation (was at `agents/.lab/amy-env-orientation/` but deleted).
- **Finding**: Amy's #1 failure is PATH_HALLUCINATION (8/10 low-quality sessions). Skill written.
- **Next**: Recreate lab fork and run baseline/treatment trials
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

## P1: EXP-251 — Tech-Lead PATH_HALLUCINATION Investigation — TEXT COACHING FAILED (Jul 29)
- Tech-lead C7.1 is **#1 convention failure system-wide** — still 14 fails in last 7d despite skill update
- Real violations: `/Users/jash/`, `/Users/amadad/`, `/Users/bloom/`
- Updated skill with actual hallucinated paths + STOP-CHECK section (Jul 28)
- **RESULT**: Text coaching at ceiling — no improvement after update. Confirmed KE-338.
- **NEXT**: Escalate to tech-lead/may for CODE-LEVEL enforcement (bash wrapper or pre-command check). Text interventions exhausted.

## P1: Quality Trend Analysis ✅ DONE (Jun 29)
- **Output**: `agents/coach/workspace/quality-trend-analysis-20260629.md`
- **Finding**: All agents improved +25pp avg over 4 weeks (0.68 → 0.93). Convention coaching + finish-guard + context.md embedding drove the improvement.
- **Answers Hao's P0 question**: Skills/training DO work at the system level. Per-skill attribution still needs gym A/B tests.
- **Next**: Need GYM_AGENT_BIN configured to run actual A/B experiments for per-skill attribution.

## P1: EXP-251 — Targeted FM-3.3/FM-1.3 Coaching ✅ DONE (Apr 25)
- **Output**: `agents/coach/workspace/EXP-251-results.md`
- **Finding**: Bob FM-3.3 rate dropped 20% → 4.2% (-15.8pp). QA FM-1.3 rate dropped 28.6% → 5.0% (-23.6pp). Both avg quality improved ~+0.3. Context.md one-line coaching works.
- **Next**: Identify next coaching target when eval data resumes

## P1: EXP-261 — Procedural Bug-Fix Skill ✅ DONE (Jul 2) — NEGATIVE RESULT
- **Output**: `agents/coach/workspace/EXP-261-results.md`
- **Scenario**: partial-verification-trap (baseline 11%, treatment 6%)
- **Finding**: Task-level procedural prompting makes things WORSE. Confirms KE-123/133.
- **Unblocked gym runner**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works!
