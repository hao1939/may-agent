# Coach Todo

## P1: EXP-415 — Hidden Constraints Refactor (Planning Goldilocks) — CLOSED ✅ POSITIVE
- **Problem**: EXP-400/405/410 all INCONCLUSIVE — explicit-dependency scenarios hit ceiling
- **Hypothesis**: Hidden constraints in files + simple task framing → baseline ≤67%; decompose-before-acting skill → +20pp
- **Scenario**: `agents/gym/scenarios/hidden-constraints-refactor/`
- **Design**: `agents/coach/workspace/EXP-415-hidden-constraints-design.md`
- **Baseline**: 2/3 pass at ≥6/7 threshold (67%) — GOLDILOCKS ACHIEVED
- **Treatment**: 3/3 pass at 7/7 (100%) — +33pp, exceeds +20pp target
- **Results**: `agents/coach/workspace/EXP-415-treatment-results.md`
- **Status**: CLOSED ✅ POSITIVE. Decompose-before-acting skill works on hidden-constraint scenarios.
- **Next**: Deploy to bob/coder for complex refactoring tasks. Consider replication on second scenario.

## P1: EXP-410 — Planning Under Complexity — CLOSED (CEILING)
- **Problem**: EXP-400/405 both INCONCLUSIVE — no scenario in goldilocks zone for planning skill
- **Hypothesis**: 12-item task with 3 dependency chains → baseline ≤60%; decompose-before-acting skill → +20pp
- **Scenario**: `agents/gym/scenarios/planning-dependency-chain/`
- **Design**: `agents/coach/workspace/EXP-410-planning-complexity-design.md`
- **Results**: `agents/coach/workspace/EXP-410-baseline-results.md`
- **Status**: CLOSED — baseline 3/3 (100% pass). Scenario at ceiling. Tasks given in order are too easy.

## P1: EXP-400 — Mid-Session Planning Skill — CLOSED (INCONCLUSIVE)
- **Problem**: Agents proceed linearly on complex tasks without re-planning when things go wrong
- **Hypothesis**: Cognitive planning skill (decompose-before-acting) → ≥+33pp on complex scenarios
- **Design**: `agents/coach/workspace/EXP-400-mid-session-planning-design.md`
- **Skill**: `agents/skills/decompose-before-acting.md`
- **Status**: CLOSED — partial-verification-trap at floor (1/6 both arms), heartbeat-pressure at ceiling (6/7 both arms). No scenario in goldilocks zone to measure.
- **Follow-up**: EXP-405 also INCONCLUSIVE. Need scenario where planning failures (not coding inability) cause task failure.
- **Results**: `agents/coach/workspace/EXP-405-results.md`

## P1: EXP-405 — Decompose-Before-Acting on Heartbeat-Pressure — CLOSED (INCONCLUSIVE)
- **Problem**: EXP-400 hit floor. Needed planning-heavy scenario instead.
- **Scenario**: `heartbeat-pressure` (7 checks, multi-task triage)
- **Result**: Baseline 3/3 pass (6/7 checks), treatment 2/3 pass (one error). Ceiling — skill can't demonstrate value.
- **Design**: `agents/coach/workspace/EXP-405-planning-under-pressure-design.md`
- **Results**: `agents/coach/workspace/EXP-405-results.md`
- **Next**: Need harder multi-task scenario (10+ items, interdependencies, baseline ≤60%)

## P1: Iteration-Cap Review (Sep 13) — DONE ✅
- Reviewed all projects that hit iteration cap 50
- All are genuinely complete (goals met or formally closed): coach-quality, skill-workflow-audit, documentation-gen, agent-convention-compliance, agent-system-literacy, gym-quality-improvement, system-efficiency, test-coverage, workflow-reliability
- No action needed — notification resolved.

## P1: EXP-395 — Finish Evidence Quality Correlation — CLOSED (INCONCLUSIVE)
- **Problem**: verification_evidence in finish() may be boilerplate vs genuinely catching issues. Does specificity matter?
- **Hypothesis**: Enriched evidence instructions (exact paths + content + before/after) → ≥20pp better pass rate
- **Method**: 2 arms × 2 trials = 4 gym runs
- **Design**: `agents/coach/workspace/EXP-395-finish-evidence-quality-correlation-design.md`
- **Results**: `agents/coach/workspace/EXP-395-results.md`
- **Finding**: Both arms 100% on core checks (ceiling). Enriched evidence 50% complied with. No quality improvement.
- **Decision**: Keep current evidence requirements as-is. Don't add enriched format.
- **Closed**: 2025-01-29. Evidence format is orthogonal to work quality.

## P1: EXP-390 — Anti-Shallow Threshold Optimization — CLOSED (INCONCLUSIVE)
- **Problem**: Anti-shallow threshold (≥10 calls) was heuristic. Need to validate via gym A/B test.
- **Hypothesis**: Threshold=15 ≥ threshold=10 in pass rate; threshold=5 is ≥20pp worse.
- **Method**: 3 scenarios × 3 arms × 2 trials = 18 gym runs
- **Design**: `agents/coach/workspace/EXP-390-anti-shallow-threshold-optimization-design.md`
- **Results**: `agents/coach/workspace/EXP-390-arm-a-c-results.md`
- **Ran**: 12/18 runs (Arms A and C). Arm B skipped — no point.
- **Finding**: H2 NOT CONFIRMED. Threshold=5 only -17pp worse (below 20pp threshold). Scenarios are either at floor or ceiling — threshold doesn't affect task quality. Anti-shallow rule's value is binary (prevents empty sessions), not gradient.
- **Decision**: Keep threshold=10. Close as INCONCLUSIVE.
- **Closed**: 2025-01-28. Anti-shallow rule's value is binary (prevents empty sessions), not gradient.
- **Variants**: 9 scenario variants created in `agents/gym/scenarios/*-exp390-arm-{a,b,c}`

## P1: EXP-385 — Anti-Shallow Rule Effectiveness Measurement — CLOSED (SUPERSEDED by EXP-390)
- **Problem**: ANTI-SHALLOW RULE deployed months ago but never measured. Does ≥10 tool calls actually correlate with meaningful output?
- **Finding**: Tool-call counts not logged in last-session.md. Cannot measure retrospectively.
- **Superseded**: EXP-390 confirmed the rule's value is binary (prevents empty sessions), not gradient. Threshold doesn't affect task quality. No further measurement needed.
- **Design**: `agents/coach/workspace/EXP-385-anti-shallow-effectiveness-design.md`

## P1: EXP-375 — Intervention Durability 30-Day Recheck — CLOSED ✅ NO REGRESSION
- **Problem**: EXP-370 only tested 3 scenarios. Need to expand coverage to conflicting-requirements-tradeoff and behavior-escalation-stubborn.
- **Results**: 4 trials, 18/18 checks pass (100%). Both new scenarios at ceiling. No regression.
- **Design**: `agents/coach/workspace/EXP-375-intervention-durability-design.md`
- **Results**: `agents/coach/workspace/EXP-375-results.md`
- **Next**: EXP-380 in 30 days.

## P1: EXP-370 — Cumulative Intervention Regression Check — CLOSED ✅ NO REGRESSION
- **Problem**: All interventions last measured Jul 2026. Evaluator dead 105+ days. Need gym-based regression check.
- **Trial 1 (Sep 3)**: 19/20 checks pass. No regression detected.
- **Trials 2-3 (Sep 5)**: 19/20 and 19/20. All 3 trials consistent. 57/60 checks pass (95%).
- **Result**: OUTPUT FORMAT ✅ (3/3), verify-before-finish ✅ (3/3), verify-after-edit ✅ (3/3). No regression.
- **Design**: `agents/coach/workspace/EXP-370-regression-check-design.md`
- **Results**: `agents/coach/workspace/EXP-370-results-final.md`

## P1: EXP-360 — Workflow-Level Forced Verification Step — CLOSED (INCONCLUSIVE)
- **Problem**: verify-after-edit fails as text instruction (KE-338) but succeeds as separate workflow phase (verify-wrap 100% vs plain 60%)
- **Hypothesis**: Adding a mandatory Phase 3 VERIFY step to multi-edit-workflow will raise median from 5/9 to ≥8/9
- **Scenario**: `agents/gym/scenarios/convention-verify-multi-edit-workflow-gated/`
- **Design**: `agents/coach/workspace/EXP-360-workflow-verify-step-design.md`
- **Results**: `agents/coach/workspace/EXP-360-results.md`
- **Status**: CLOSED — INCONCLUSIVE. Baseline improved to 8/9 (was 5/9 in EXP-355). Gated variant shows no incremental benefit. Prior SOUL.md + context.md interventions already solved this.
- **Conclusion**: No workflow-level verify gates needed — cumulative text interventions ARE working for this scenario class.

## P1: EXP-355 — Convention Compliance Stability Measurement — CLOSED ✅
- **Problem**: Convention compliance reported as peak (88.2%) but live runs show 75-92% variance. Single-run measurements are unreliable.
- **Design**: `agents/coach/workspace/EXP-355-convention-stability-design.md`
- **Results**: `agents/coach/workspace/EXP-355-stability-results.md`
- **Protocol**: Run 9 convention scenarios × 3 trials = 27 runs. Report median + range.
- **Status**: CLOSED ✅ — True compliance is **80% [78-90]**. The 98% was a best-case outlier. verify-after-edit is #1 gap. Text coaching dead; needs structural enforcement.
- **Key finding**: 12pp run-to-run variance confirms single measurements are unreliable.

## P1: EXP-350 — Verify-After-Edit Verbal Commitment Gate — CLOSED (INCONCLUSIVE)
- **Problem**: verify-after-edit at ~9% compliance. Text coaching DEAD (EXP-280 NEGATIVE). Context.md gate ignored.
- **Hypothesis**: Verbal commitment protocol + gym scenario can determine if behavior is trainable or needs tool-layer enforcement
- **Design**: `agents/coach/workspace/EXP-350-verify-after-edit-verbal-gate-design.md`
- **Results**: `agents/coach/workspace/EXP-350-arm-results.md`
- **Status**: CLOSED — No-instruct 50% vs instruct 53% (+3pp, noise). Text instruction has ZERO effect. Behavior is bimodal (0/3 or 3/3) and stochastic.
- **Conclusion**: Confirms KE-338. Only tool-layer enforcement can solve verify-after-edit. Escalate to infrastructure.

## P1: EXP-345 — Judgment Scenario Treatment — CLOSED ✅ POSITIVE (directional) — DEPLOYED
- **Problem**: All gym scenarios at ceiling (90-100%). Can't drive skill improvement.
- **Scenario**: `conflicting-requirements-tradeoff` — tests whether agent detects incompatible stakeholder requirements
- **Baseline**: 67% behavior pass (2/3 runs). Run 3 failed all 3 judgment checks. CEILING BROKEN.
- **Treatment**: requirement-conflict-check skill loaded via coaching/my-instructions.md
- **Results**: Treatment 2/3 full pass (67%) vs baseline 0/3 (0%). Catastrophic failure (0/3 checks) ELIMINATED.
- **Design**: `agents/coach/workspace/EXP-345-treatment-design.md`
- **Results**: `agents/coach/workspace/EXP-345-treatment-results.md`
- **Skill**: `agents/skills/requirement-conflict-check.md`
- **Status**: CLOSED ✅ POSITIVE. **DEPLOYED** to bob/context.md and coder/context.md (this session).

## P1: EXP-340 — Verify-After-Edit Structural Gate — SUPERSEDED
- **Problem**: verify-after-edit at 9% compliance. EXP-280 text coaching NEGATIVE.
- **Finding**: Bob's context.md ALREADY has the structural gate (MANDATORY: After EVERY write/edit, read to verify). Gate exists but compliance is still low → problem is not missing instruction but instruction-following.
- **Status**: SUPERSEDED. Context.md gate already deployed. Need CODE-LEVEL enforcement (tool-layer auto-readback), not more text.
- **Design**: `agents/coach/workspace/EXP-340-verify-after-edit-structural-design.md`

## P1: EXP-335 — Output Format Gym Measurement (NEW Sep 2) — CLOSED ✅ POSITIVE
- **Problem**: EXP-330 designed but evaluator dead — can't measure. Need gym-based measurement.
- **Treatment**: Gym scenario `output-format-compliance` tests GOAL/PLAN/DONE WHEN compliance directly.
- **Design**: `agents/coach/workspace/EXP-335-output-format-gym-measurement-design.md`
- **Scenario**: `agents/gym/scenarios/output-format-compliance/`
- **Results**: `agents/coach/workspace/EXP-335-treatment-results.md`
- **Status**: CLOSED ✅ — Treatment 3/3 (100%) vs baseline 0/2 (0%). Delta +100pp exceeds +40pp target.
- **Bug fixed**: success_criteria.js was searching raw JSONL with regex instead of parsing assistant messages.
- **Conclusion**: OUTPUT FORMAT instruction is the causal driver of compliance. Proceed with EXP-330 rollout.

## P1: EXP-330 — Output Format Batch Rollout (NEW Sep 2) — CLOSED ✅ DEPLOYED
- **Problem**: Only 4/10 agents have OUTPUT FORMAT. Pattern proven +32pp.
- **Treatment**: Add OUTPUT FORMAT to scout, qa, coder, may, amy heartbeat.md
- **Design**: `agents/coach/workspace/EXP-330-output-format-batch-rollout-design.md`
- **Status**: CLOSED ✅ — All targets now have OUTPUT FORMAT in heartbeat.md (verified: amy, scout, qa, tech-lead, may, bob, optimizer, dev all confirmed).
- **Result**: 9/9 active agent heartbeat.md files contain OUTPUT FORMAT. Full rollout complete.

## P1: EXP-325 — Self-Scoring Checklist (NEW Sep 1) — CLOSED (SUPERSEDED)
- **Problem**: Evaluator dead 105+ days. No quality signal for any experiment.
- **Treatment**: 5-point binary self-score checklist in coach/context.md
- **Design**: `agents/coach/workspace/EXP-325-self-scoring-design.md`
- **Status**: CLOSED — SUPERSEDED. Checklist criteria already enforced by ANTI-SHALLOW RULE and PRE-FINISH GATE in heartbeat/context. Self-scoring adds no incremental value.

## P1: EXP-320 — Output Format Rollout to Tech-Lead and Amy (NEW Jul 16) — CLOSED ✅ DEPLOYED
- **Problem**: Only 3/10 active agents have OUTPUT FORMAT. Pattern proven +32pp.
- **Treatment**: Add OUTPUT FORMAT to tech-lead/heartbeat.md and amy/heartbeat.md
- **Design**: `agents/coach/workspace/EXP-320-output-format-rollout-design.md`
- **Status**: CLOSED ✅ — Both tech-lead and amy heartbeat.md confirmed to contain OUTPUT FORMAT. Subsumed by EXP-330 full rollout.

## P1: EXP-315 — Bob Output Format Enforcement (NEW Sep 1) — DEPLOYED ✅
- **Problem**: Bob lacks OUTPUT FORMAT in heartbeat.md. Only 2/6 agents have it. Pattern proven +32pp (coach), TBD (optimizer).
- **Treatment**: Add OUTPUT FORMAT section to bob/heartbeat.md
- **Design**: `agents/coach/workspace/EXP-315-bob-output-format-design.md`
- **Status**: DEPLOYED ✅ (confirmed Jul 16) — OUTPUT FORMAT already present in bob/heartbeat.md
- **Baseline**: 0.671 JS quality (n=48)
- **Target**: ≥0.72 JS quality
- **Measurement due**: 48h post-deployment (blocked on evaluator being dead since Apr 30)

## P1: EXP-310 — Optimizer Quality Improvement (NEW Aug 14) — DEPLOYED ✅
- **Problem**: Optimizer worst JS quality (0.487, n=356). INSTRUCTION_NONCOMPLIANCE in 80% of low sessions.
- **Treatment**: Strengthen OUTPUT FORMAT + EXECUTION RULES in optimizer/heartbeat.md (same pattern that fixed coach)
- **Design**: `agents/coach/workspace/EXP-310-optimizer-quality-design.md`
- **Status**: DEPLOYED ✅ (confirmed Sep 1) — all 3 treatments in optimizer/heartbeat.md
- **Baseline**: 0.487 JS quality (n=356)
- **Target**: ≥0.55 JS quality
- **Measurement due**: 48h post-deployment (blocked on evaluator being dead since Apr 30)

## P1: Heuristic Eval Bug — 261 coach sessions scored 0.20 (Aug 14)
- All heuristic evals return quality=0.20 regardless of actual session quality
- Makes combined averages misleading (coach shows 0.367 combined vs 0.493 JS-only)
- Same bug from EXP-270 findings
- **Action**: Escalate to evaluator

## P1: EXP-290 — Bob Anti-Shallow Enforcement ✅ DONE (Aug 1) — POSITIVE
- **Problem**: Bob worst quality (0.349, n=152). All low sessions are `shallow_session` (2 messages, quality=0.20).
- **Root cause**: Anti-shallow rule only in heartbeat.md, NOT context.md. Standalone sessions bypass it.
- **Treatment**: Anti-shallow rule in bob/context.md (universal loading)
- **Design**: `agents/coach/workspace/EXP-290-bob-anti-shallow-design.md`
- **Results**: `agents/coach/workspace/EXP-290-results.md`
- **Baseline**: bob avg quality 0.349 (n=152)
- **Post-treatment**: bob avg quality 0.671 (n=48) — **+32pp, target exceeded**
- **Shallow rate**: 69% → 0% (eliminated)
- **CLOSED**: POSITIVE. Replicated to coach/context.md (same pattern detected, coach at 0.36).

## P1: EXP-295 — Ghost Completion Pattern — MERGED INTO EXP-296 (Aug 14) → EXP-300
- **Problem**: Optimizer flagged recurring "ghost completion" failures
- **Finding**: Already addressed by EXP-296 (bob). `session-awareness-guard` skill exists but was wired to 0 agents.
- **Status**: SUPERSEDED by EXP-300. Skill deployed to amy, coder, tech-lead (Aug 14).

## P1: EXP-300 — Session-Awareness Guard Deployment (NEW Aug 14) — CLOSED
- **Problem**: `session-awareness-guard` existed but was wired to 0/14 agents. Ghost completions persist.
- **Treatment**: Deployed skill to amy, coder, tech-lead context.md
- **Design**: `agents/coach/workspace/EXP-300-ghost-completion-guard-design.md`
- **Baseline**: TBD — need to audit recent sessions for ghost completion rate
- **Target**: ≥50% reduction in ghost completions
- **Measurement due**: 48h post-deployment
- **Status**: DEPLOYED ✅ — preliminary measurement: insufficient data (1 post-deploy session from targets). See `EXP-300-measurement-1.md`
- **CLOSED (Aug 14)**: POSITIVE (directional). Ghost rate 4.1% system-wide (6/148 sessions). Amy 0%. See `EXP-300-measurement-2.md`.

## P1: EXP-305 — Session-State Confusion Pre-Finish Gate (NEW Sep 1) — CLOSED
- **Problem**: Root cause of ghost completions — agents confuse "project done" with "I did something this session"
- **Treatment**: Pre-finish gate rule in optimizer + coach context.md (must have ≥1 write/edit before finish(success))
- **Design**: `agents/coach/workspace/EXP-305-session-state-confusion-design.md`
- **Predecessor**: EXP-296 (bounded damage), EXP-300 (awareness guard)
- **Target**: ≥70% reduction in ghost completions
- **Status**: DEPLOYED ✅ (Aug 14) — pre-finish gate in coach + optimizer context.md
- **CLOSED (Aug 14)**: POSITIVE (directional). Ghost rate 4.1% combined with anti-shallow rules. See `EXP-300-measurement-2.md`.

## P1: EXP-285 — PATH_HALLUCINATION Guard Effectiveness (NEW Aug 1)
- **Problem**: PATH_HALLUCINATION #1 convention failure (tech-lead 22/7d). Text coaching dead (EXP-251).
- **Finding**: Guard exists as `block` type but only fires in workflow sessions. Bash SIG already blocks in direct sessions.
- **Status**: Phase 1 DONE — guard audited. Need to measure whether SIG is actually reducing violations or just recovering them.
- **Design**: `agents/coach/workspace/EXP-285-path-hallucination-guard-design.md`
- **Next**: Get fresh evaluation data to see if PATH_HALLUCINATION rate has decreased since SIG deployment

## P1: EXP-280 — Verify-After-Edit Enforcement (CLOSED Aug 1) — NEGATIVE
- **Problem**: verify-after-edit at 9% compliance system-wide, 502 failures/7d. Text coaching dead (KE-338).
- **Treatment**: Deploy hard-rule gate skill + heartbeat enforcement to bob (highest violation count)
- **Status**: DEPLOYMENT REQUESTED — notified may to deploy skill + heartbeat changes (coach lacks write access)
- **Design**: `agents/coach/workspace/EXP-280-verify-after-edit-enforcement-design.md`
- **Log**: `agents/coach/workspace/EXP-280-deployment-log.md`
- **Project**: verify-after-edit-enforcement
- **Baseline**: <20% estimated (system-wide 9%, bob 120 failures — highest)
- **Target**: ≥50% compliance (from <20%)
- **Status**: DEPLOYED ✅ — confirmed 2026-04-30. BASELINE UPDATED: FM-3.3 at 53% (8/15), not 30%. Measurement due when 10+ post-treatment sessions available.
- **Results**: `agents/coach/workspace/EXP-280-results.md`
- **Measurement plan**: `agents/coach/workspace/EXP-280-phase3-measurement-plan.md`
- **CLOSED (Aug 1)**: NEGATIVE — FM-3.3 50% vs 53% baseline (no change). Text skill dead per KE-338.

## P1: EXP-275 — Optimizer Anti-Shallow + Verification — CLOSED (Aug 1)
- **Problem**: Optimizer worst LLM quality (0.384, n=17). Issues: UNVERIFIED_CLAIMS, LAZY, VERIFICATION_FAILURE.
- **Treatment**: Same as coach (OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW) → deployed to optimizer/heartbeat.md
- **Status**: CLOSED — BASELINE-REVISED. True baseline 0.606 (n=10), already above 0.50 target. 0.384 was sampling artifact.
- **Deployed**: 2026-04-30 (commit 33d854505)
- **Design**: `agents/coach/workspace/EXP-275-optimizer-quality-design.md`
- **Measurement**: `agents/coach/workspace/EXP-275-measurement-status.md`
- **Result**: No post-treatment eval data available. Treatment remains deployed preventively.

## P1: Fresh Quality Measurement (Jul 30) — Evaluator ALIVE
- Evaluator confirmed alive: 185+ evals in 6h
- **All agents LLM-only (6h, Jul 30)**:
  - optimizer: 0.384 (n=17) ← WORST
  - tech-lead: 0.510 (n=2)
  - coach: 0.516 (n=40) ← above 0.50 target ✓
  - scout: 0.560 (n=7)
  - may: 0.572 (n=25)
  - qa: 0.581 (n=8)
  - amy: 0.721 (n=28)
  - bob: 0.731 (n=8) ← BEST

## P1: EXP-270 — Anti-Shallow Sessions ✅ DONE (Jul 11) — POSITIVE (directional)
- Coach treatment active (ANTI-SHALLOW RULE in heartbeat.md) — WORKING
- Bob treatment: ✅ DEPLOYED in `agents/bob/heartbeat.md` (≥5 tool calls minimum)
- **Results**: `agents/coach/workspace/EXP-270-results.md`
- **Finding**: Bob LLM q=0.67 (n=36), Coach q=0.49 (n=278). Heuristic evals all 0.20 (bug).
- **Design**: `agents/coach/workspace/EXP-270-anti-shallow-design.md`
- **Re-measurement (Jul 18)**: INCONCLUSIVE — evaluator dead since Apr 30, no post-treatment data. See `EXP-270-remeasurement.md`
- **Status**: CLOSED as inconclusive. Treatments remain deployed.

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

## P0: Evaluator Dead — RE-DEAD (Aug 13)
- **Previously resolved**: Jul 3. Now dead again — last evaluation 2026-04-30T15:46:14Z (105 days ago).
- **Evaluator heartbeats run** but produce no evaluations. Re-escalated to may (P0).
- **Impact**: ALL coaching measurement is blind. Cannot verify any experiment results.

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
