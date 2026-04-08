# Bob's Todo List

## Active Tracking
- [x] **EXP-091 (Few-Shot on Process Discipline)**: COMPLETE. Few-shot crosses to process discipline — reproduce-first 0%→100% (N=3+3). Matched few-shot 15/15 across 6 scenarios. H-091 P(H) 0.98→0.99. KE-059/H-091/INDEX/PRIORITY-TRACKER updated.
- [ ] **EXP-092 (Forced Analysis-to-Documentation Transfer)**: DESIGNED and delegated to Coach. Two-arm test targeting EXP-070's transfer gap (60% → predicted ≥90%). Arm A: forced citation. Arm B: post-check. N=10/arm.
- [x] **EXP-215 (Prerequisite Detection Skill)**: CONCLUDED. N=10 fixed re-run: all 10 fail `does-not-claim-success`. C1.8 deployed but ineffective. Rule of Two triggered — model-level limitation. ACCEPTED.
- [x] **Gym Sweep Part 3 COMPLETE**: 31/33 scenarios tested (wrong-tool-args pair cut off). 23 PASS, 8 FAIL. New failures: regression-from-fix (2), search-strategy-escalation, silent-dependency, spec-adherence-multi-step, stale-approach-fixation-workflow, sycophants-dilemma (confirmed), verification-contradiction-workflow. **FULL SWEEP TOTALS**: 108/111 tested, 77 PASS, 30 FAIL (27.8% failure rate). 3 untested (wrong-tool-args pair + 1 other).
- [x] **Verify-After-Edit v1 in Production**: Skill deployed at `agents/coder/skills/verify-after-edit.md`. **CONFIRMED WORKING (2026-03-29)**: Coder C1.3 pass rate = 62.3% (43/69 sessions, 7-day). Consistent with lab result (60%). Prompting ceiling reached — remaining 38% needs runtime enforcement.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [x] **Runtime Finish-Guard for Contradictory Status (REVERTED)**: Gates 3/3b were deployed (commits `45812bc`, `ca53a87`) then **reverted by Hao** (commit `b12c138`). Reason: guards hardcode environmental assumptions. context.md facts deployed instead. 0/6 pass rate on validation confirmed guards ineffective anyway. See `agents/shared/may-agent-docs/design/code-vs-data-decisions.md`.
- [ ] **EXP-216 (Regression Awareness Skill)**: DEPRIORITIZED. Coach diverted 3x (req:65b37587, req:c1f9a5f0 both marked COMPLETED without running on `regression-from-fix`). Rule of Two for delegation triggered. Skill designed and ready at `agents/.lab/regression-awareness-skill/`. Low priority — only 2 of 108 scenarios affected. Will revisit if Coach gets better at following delegated experiment designs.
- [ ] **Complete remaining 3 scenarios**: wrong-tool-args, wrong-tool-args-workflow (cut off in sweep part 3). Delegate to Coach.
- [x] **Tech-Lead jsonSchema Blocker**: SELF-RESOLVED (2026-03-29). Was intermittent — 1 error in last 6h, subsequent heartbeats completing normally. No longer blocking.
- [x] **C12.1 Convention Miscalibration → Module Cache**: Fix deployed in code (2026-03-29 20:43) but NOT LIVE due to Bun module cache. See C12.1 Module Cache (P0) entry above.
- [x] **C1.3 Production Gap — NOW LIVE**: All exempt patterns + grep verification heuristic now active (hot-reload since 06:43 UTC). Post-restart C1.3=100% (N=2). 6h rate=81.1% (includes pre-restart data). Monitoring for stabilization with larger N.
- [x] **C6.1 Threshold Recalibration — DONE (2nd time)**: Raised BUDGET_THRESHOLD from 60→80 in convention-check.ts (2026-03-31 02:10). Post-opBudget, 48-74 tool calls are normal for complex work. New threshold = ~97th percentile. Blocked by module cache.
- [x] **C12.1 cd-prefix + cat/head/tail fix — DONE**: `cd /app && grep` was failing regex. Added prefix stripping and cat/head/tail to allowed orientation commands (2026-03-30 20:40).
- [x] **C12.1 Module Cache (P0) — RESOLVED**: Fix was in source since 2026-03-29 20:43. Process restarted 2026-03-30 07:47 (new build `84e05c6`, opBudget removal commit). **41+ hour blocker cleared.** Post-restart C12.1 at 66.7% (2/3, N=3) — up from 0%. Both C12.1 (CONTEXT_FILE_PATTERNS) and C1.3 (C1_3_EXEMPT_PATTERNS) handler-level fixes now LIVE.
- [x] **C2.1 False Positive Fix — RESOLVED**: `isError` guard deployed and NOW LIVE (hot-reload fix active since 06:43 UTC). Post-restart C2.1=100%. The isError=false guard for `<tool_output>` wrapped content eliminates false positives from file content containing error-like strings.
- [x] **Convention Handler Module Cache (META-ISSUE)**: **RESOLVED** — Binary rebuilt at 06:43 UTC 2026-03-31 from `dc7595b` (includes `fd5b559` hot-reload fix). Handler modules now re-import on each cron invocation with cache-busting. All convention-check code changes auto-apply. Permanently resolved.
- [ ] **Amy-Kimi C8.2 Compliance**: 0/16 in 24h. **ROOT CAUSE FOUND**: Kimi-K2.5 generates malformed JSON in finish() arguments (e.g., `"success','summary\":"...`). The model attempts to call finish() but the JSON is unparseable, so summary/completed_items are never extracted. This is a model-level tool-calling bug, not a prompting issue. Options: (a) runtime JSON repair in tool-call parser, (b) exempt Amy-Kimi from C8.2, (c) accept as model limitation.
- [x] **EXP-079 Integration**: Cross-reference intervention 100% (3/3) on L3 absent-field detection. KE-057 written by Coach. Integrated into INDEX.md, H-085, PRIORITY-TRACKER. Cross-reference is complementary mechanism to externalization — works via external evidence discovery (codebase as schema) where externalization fails (absent-field = missing knowledge, not missing analysis).
- [x] **H-089 Filed**: Environmental Evidence Discovery — the second general-purpose intervention mechanism, complementary to H-085 externalization. Covers absent-information failures (agent lacks info that exists in environment). P(H)=0.65. Registered in INDEX.md and PRIORITY-TRACKER.md.

## Completed / Closed
- [x] **Path Hallucination Guard QA** (2026-03-29): Reviewed and QA'd (commit `36f0c27`). **REVERTED by Hao** (commit `b12c138`): `/home/hao` now mounted for flexnodehelper — guard would block real work. Replaced by context.md fact ("Project root is /app — do not use /home/*, /Users/*, ~/ paths"). Lesson: environmental constraints belong in data, not code.
- [x] **EXP-214 (Verify-After-Edit v2)**: REJECTED — catastrophic regression (10% vs 60% v1). v1 promoted instead.
- [x] **EXP-213 (Verify-After-Edit v1)**: 2x improvement (30% → 60%). Promoted to production.
- [x] **EXP-212 (Materialization v2)**: Rule of Two triggered. 7/9 ceiling accepted.
- [x] **EXP-211 (Materialization v1)**: Improved 6/9 → 7/9. Prompting ceiling for materialization.
- [x] **EXP-210 (Investigation Skill)**: INVALIDATED — scenario bug, not skill failure.
- [x] **Gym Sweep Parts 1-2**: 77/111 tested, 54 PASS, 22 FAIL (29% failure rate).
- [x] **Research**: Reviewed `ideas.md` and published `agents/shared/knowledge/synthesis/2026-03-17-agent-framework-insights.md`.
- [x] **SOUL Updates**: Verified P13/P108 present in May/Evaluator/Master SOULs.
- [x] **Infra Verification**: Confirmed `finish`, `verbose-tools`, `opbudget` are deployed.

## Deferred / Blocked
- [ ] **Prompt Caching**: Blocked on Hao (escalated 2026-03-24). Cannot fix from this repo.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% of verify-after-edit failures need code-level fix, not prompting. Deferred until prompting experiments complete.
- [ ] **Judgment Frontier (3→2 scenarios after EXP-090)**: behavior-escalation-stubborn, judgment-ambiguous-spec. ~~escalation-impossible-task~~ SOLVED by few-shot (EXP-090, 0→100%). ~~sycophants-dilemma~~ SOLVED by few-shot (EXP-087, 0→100%). Remaining 2 confirmed resistant to prompting. Accept as model-level limitations unless fine-tuning becomes available.

## Session Notes (2026-03-31 07:10)
- **HOT-RELOAD IS LIVE**: Binary rebuilt from `dc7595b` at 06:43 UTC. All convention-check code changes now auto-apply via hot-reload. Module cache blocker permanently resolved.
- **Post-restart convention rates (N=2)**: C6.1=100%, C2.1=100%, C1.3=100%, C12.1=0% (claude_code FP → fixed).
- **6h convention rates (N=37)**: C1.1=94.6%, C1.3=81.1%, C1.4=97.3%, C1.5=94.6%, C1.7=100%, C12.1=89.2%, C2.1=97.3%, C3.2=94.6%, C3.3=100%, C6.1=83.8%, C7.1=100%, C8.2=83.8%
- **Evaluation health**: 32 good, 3 acceptable, 0 poor (6h). Excellent.
- **New tools**: `claude_code` tool added (commit `dc7595b`) — master delegates to external CLI agents.

## Session Notes (2026-04-08 ~04:00)
- **EXP-076 Phase 1 COMPLETE**: Workflow access expansion audit. Bob is #1 candidate for workflow tool access (score 13/15). 99.9% of Bob's sessions run unprotected. 100% of Bob's tasks are judgment-intensive. FM-3.3 (verification) and FM-2.6 (tool misuse) directly addressable by workflow guard. `deliver-or-report` workflow already exists. Action needed: May/Hao add `"workflow"` to `agents/bob/agent.json` + heartbeat instruction for WORK SESSION tasks.
- **EXP-075 CLOSED**: CTA deployment to Bob's heartbeat — baseline at ceiling (3/3 pass, 6/6). Treatment skipped. CTA already works.
- **Skill pruning CONFIRMED COMPLETE**: Optimizer executed. Coach 20→3 .md skills, Evaluator 13→5 .md skills. KE-025 compliance achieved.
- [x] **EXP-080 integration**: COMPLETE. KE-057 updated with L2 skill evidence (67% vs L3's 100%). H-089 P(H) 0.65→0.70 with EXP-080 dosage model. INDEX.md KE-057 + H-089 entries updated. PRIORITY-TRACKER H-089 updated.
- [x] **EXP-077 integration**: COMPLETE. KE-053 updated with EXP-077 findings. INDEX.md updated with EXP-077 row.
- **Systemic finding from EXP-076**: C12.1 fails across ALL agents (14.6%–58.9% pass rate). This is the single worst convention system-wide. Not agent-specific — needs systemic fix.

## Session Notes (2026-04-08 ~09:50)
- **INTEGRATION SESSION**: EXP-083 baselines, EXP-084, KE-059, H-091 all integrated into knowledge base.
- **PRIORITY-TRACKER updated**:
  1. H-091 added to Tier 1 (P(H)=0.75) — skill delivery methods between text rules and workflow enforcement
  2. EXP-084 added to experiment queue (COMPLETE — H-091 SUPPORTED)
  3. EXP-083 status updated (BASELINES COMPLETE — Phase 2 running)
  4. Meta-process section updated: 10 high confidence (was 9), H-091 added to list
  5. Header updated with current state
- **H-089 updated**: P1 prediction now shows BASELINES COMPLETE with full quantitative results (100% visible, 0% silent across both domains). Phase 2 treatment runs running via Coach.
- **Connections noted**: H-091 partially bridges H-043's utilization dead zone — few-shot examples achieve measurable transfer (P(applies) > 0) where text rules and pushed declarative knowledge both = 0%. This is the first empirical evidence of intermediate delivery methods.
- **EXP-083 Phase 2 COMPLETE**: Treatment runs on truncated-env-repair-xref and truncated-schema-migration-xref finished. 24/24 silent checks passed (100%), p<0.0001. H-089 P1 CONFIRMED. H-089 promoted to Tier 1 (P(H) 0.70→0.92).

## Session Notes (2026-04-08 ~08:20)
- **EXP-083 DESIGNED**: Cross-Reference Generalization — Multi-Domain Absent-Information Test. Tests H-089 P1 (cross-reference generalizes across domains).
- **4 new gym scenarios created**:
  1. `truncated-env-repair` — .env truncated (4 of 8+ vars present). 6 visible failures (tests show), 2 silent failures (webhook vars — only in source). Baseline.
  2. `truncated-env-repair-xref` — Same + cross-reference instruction in task.md + injected_context.md skill. Treatment.
  3. `truncated-schema-migration` — SQL schema truncated (4 of 7 columns). 1 visible failure (role — tests show), 2 silent failures (avatar_url, last_login — only in user-model.js). Baseline.
  4. `truncated-schema-migration-xref` — Same + cross-reference instruction + injected_context.md skill. Treatment.
- **All success criteria tested and verified**: Broken state fails correctly. Visible-only fix gets "Partial fix: Agent did NOT cross-reference..." message. Complete fix passes all checks.
- **H-089 updated**: P1 status → EXP-083 DESIGNED. Next Experiments section → EXP-083 ready to run. Cross-reference added to experiments list.
- **Experiment design filed**: `agents/shared/knowledge/experiments/EXP-083/design.md`
- **Protocol**: Phase 1 baselines (N=6 × 2 scenarios), Phase 2 treatments (N=6 × 2 scenarios). 24 total runs.
- **Ready for Coach**: Baselines can be run by Coach using standard gym infrastructure.

## Session Notes (2026-04-08 ~07:05)
- [x] **EXP-081 + EXP-082 integration**: COMPLETE. Both experiments now fully integrated into knowledge base.
- **EXP-081 (KE-002 Reexamination)**: Already integrated by Coach — KE-002 updated (0/32 across 5+ categories), INDEX.md has experiment row. No additional updates needed.
- **EXP-082 (Knowledge Application Pipeline)**: Integrated into:
  1. **H-043**: Evidence §11 added (P(applies|pushed) ≈ 0). P(applies) table expanded with knowledge-type breakdown. P(H) 0.82→0.85. References and date updated.
  2. **INDEX.md**: EXP-082 experiment row added after EXP-081.
  3. **PRIORITY-TRACKER**: H-043 probability corrected (0.72→0.85 — was stale, file said 0.82, now 0.85 with new evidence).
- **KE-058 (Injected Declarative Knowledge No Effect)**: Already existed from Coach's experiment run. No updates needed.
- **Key synthesis**: The utilization dead zone is now formally complete in H-043. For judgment-type declarative knowledge: P(access) ≈ 0 for pull AND P(applies) ≈ 0 for push. BOTH delivery mechanisms fail. Only structural form conversion (workflows, forced externalization) achieves non-zero U. This is the strongest empirical constraint on our system improvement strategy.

## Session Notes (2026-04-08 ~06:04)
- **H-089 FILED**: Environmental Evidence Discovery — A General Complement to Externalization. Filed as `knowledge/hypotheses/H-089-environmental-evidence-discovery.md`.
- **Core claim**: When agents fail because they lack information that exists in the environment (source code, schemas, tests), instructing them to discover that evidence closes the performance gap — even when externalization (self-reflection) has no effect.
- **Two-mechanism model**: H-085 covers present-but-wrong failures (analysis activation); H-089 covers absent-information failures (evidence discovery). Together they form a complete intervention taxonomy for recognition failures.
- **Evidence**: EXP-079 0%→100% (+100pp) on absent-field via cross-reference. EXP-078 externalization 0% (same as baseline). N=3, single scenario.
- **P(H) = 0.65**: Strong effect (+100pp, 100% consistency) but single scenario (N=3). Would rise to 0.80 if cross-reference generalizes to 2+ additional absent-information scenarios.
- **Five testable predictions**: P1 (generalization to other absent-info scenarios), P2 (evidence type ranking), P3 (independence from externalization via 2×2 factorial), P4 (generalization beyond config repair), P5 (high agent compliance ≥90%).
- **Registered in**: INDEX.md (hypothesis table), PRIORITY-TRACKER.md (Tier 2, active count 16→17).
- **Files created**: `knowledge/hypotheses/H-089-environmental-evidence-discovery.md`
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-08 ~05:05)
- **EXP-078 KNOWLEDGE BASE INTEGRATION**: Coach ran externalization on L3 absent-field detection (ambiguous-context-drift-L3). 0/3 pass — no improvement over 0% baseline. Agent wrote ANALYSIS.md but never listed missing `max_age` field because original config was deleted.
- **INDEX.md UPDATED**: EXP-078 row added after EXP-077.
- **H-085 UPDATED (4 changes)**: (1) Formal statement adds condition 4: "problem information must be present in the environment." (2) EXP-078 row in convergence table (0% → 0%, 0pp). (3) Aggregate adjusted: 51/57 across 12 scenarios (was 55/60 across 13 — corrected). (4) Recognition sub-boundary section added. (5) Source line + footer updated. P(H) stays 0.92.
- **KE-054 UPDATED**: Decision rule table extended with "Missing field/element detection (no schema)" → ❌ Do not deploy.
- **Key insight formalized**: Externalization has a *recognition sub-boundary*: helps "present-but-wrong" (agent can examine existing elements and notice mismatch) but NOT "absent-field" (agent has no schema reference for what should exist). This is a fundamentally different failure mode — it's not a judgment failure but an information absence.

## Session Notes (2026-04-08 ~04:35)
- **KE-053 UPDATED WITH EXP-077 FINDINGS**: Integrated Coach's EXP-077 (Fidelity Ladder) results into KE-053. Three major additions:
  1. New "EXP-077: Fidelity Ladder" subsection under Evidence with full results table and 5 critical findings
  2. Gap hierarchy revised from 5 co-equal gaps to prioritized stack: cascading state (PRIMARY) >> deliverable completeness (SECONDARY) >> context noise ≈ task ambiguity (NEGLIGIBLE)
  3. Each structural gap annotated with EXP-077 findings (Gap 1: NEGLIGIBLE, Gap 2: SECONDARY, Gap 3: PRIMARY)
- **EXP-077 ADDED TO INDEX.md**: New experiment table row after EXP-074 with full results summary
- **Quantitative summary expanded**: 3 new EXP-077 rows added (L1: 67%, L2: 100%/0%, L3: 0%)
- **Links updated**: EXP-077 synthesizes link + KE-007 confirms link added
- **Key insight**: Cascading state from failed sessions (information loss) is the primary driver of the gym-production gap. Context noise and task ambiguity are negligible for core work. This narrows the intervention target significantly.

## Session Notes (2026-04-08 ~02:10)
- **KE-SUMMARIES COMPLETE**: Extended from 19 entries (KE-001–KE-019) to all 57 entries (KE-001–KE-056 including KE-028a/b split). 38 new summaries added covering all knowledge entries from EXP-028 onward.
- **INDEX.md GAPS FIXED**: 8 missing entries (KE-014, KE-016, KE-017, KE-021, KE-022, KE-023, KE-024, KE-026) added to INDEX table. All 56 unique KE IDs now present and in order.
- **Knowledge base audit findings**: 56 KE files on disk, 57 summary entries (KE-028 has two files: security + sycophancy), all now indexed and summarized. No orphan files, no missing entries.
- **KNOWLEDGE APPLICATION AUDIT**: Created `agents/shared/knowledge/KNOWLEDGE-APPLICATION-AUDIT.md`. Three major gaps identified:
  1. **KE-025 violation**: Coach (20 skills) and Evaluator (13 skills) have excessive context files — our own data says this hurts
  2. **KE-029 undeployed**: Classify-then-act (+60pp on sycophancy) verified but not in any production agent
  3. **KE-056 not applied**: Constraint hierarchy shows L1-L2 interventions have 0% effectiveness, but we still default to them
- **Action items dispatched**: P0 skill pruning (Optimizer), P1 CTA deployment (Coach), P1 constraint hierarchy gate (Bob self-deploy)

## Session Notes (2026-04-08 ~01:40)
- **H-087 P3 RETROSPECTIVE COMPLETE**: Analyzed all 61 experiments (51 completed). Designed experiments produce KE entries 2.05x more often than ad-hoc (78.9% vs 38.5%, p≈0.013). P3 prediction of ≥2x confirmed. Analysis at `agents/shared/knowledge/experiments/H087-P3-retrospective-analysis.md`.
- **H-087 P(H) updated**: 0.65 → 0.72. Modest increase due to correlational nature and three confounds (temporal, ambition, author maturation).
- **Additional metrics**: Hypothesis resolution 1.82x, named hypothesis testing 2.39x, actionability 1.61x — all favor designed experiments.
- **Key confound**: Temporal — early experiments were all designed AND explored virgin territory. The "design causes better results" claim is supported but not proven.

## Session Notes (2026-04-08 ~00:35)
- **KE-056 WRITTEN**: The Constraint Hierarchy — Workaround Availability Dominates Instructional Interventions. Synthesizes the full EXP-070→073 arc (30 runs, 6 conditions) into a five-level constraint hierarchy: L5 action-space restriction > L4 mechanical enforcement (100%) > L3 experiential feedback (67%) > L2 instructional binding (0%) > L1 text instructions (0%) > L0 no intervention (0%).
- **Core insight formalized**: Workaround availability is the single dominant variable. Critical discontinuity between L3 and L4. Two gap types: drift gap (fixable with binding when workarounds blocked) vs attraction gap (requires mechanical enforcement).
- **KE-043 hierarchy extended**: Domain-specific calibration added — L4 splits into L4a (convergent/judgment, 100%), L4b (divergent/debugging+workarounds, 0%), L4c (divergent/debugging+blocked, 100%).
- **Cross-references updated**: KE-043, KE-054, KE-055, KE-041 all updated with back-references to KE-056.
- **INDEX.md updated**: KE-056 row added after KE-055.
- **Files created**: `knowledge/entries/KE-056-constraint-hierarchy-workaround-availability.md`
- **Files modified**: `knowledge/INDEX.md`, `KE-043-forced-externalization-complete-picture.md`, `KE-054-externalization-boundary-judgment-vs-debugging.md`, `KE-055-binding-closes-analysis-action-gap.md`, `KE-041-structural-constraint-stigmergic-coordination.md`

## Session Notes (2026-04-08 ~00:32)
- **EXP-073 Phase 2 PROCESSED**: Coach ran v2-commit cross-validation (6 runs). Binding FAILS on v2: 0/6 pipeline reorder despite 4/6 writing FIX_PLAN.md with reorder. H-088 partially disconfirmed — P(H) 0.92→0.70. Workaround availability is the critical boundary.
- **INDEX.md consistency fix**: Updated KE-055, H-088, EXP-073 rows to reflect Phase 2 partial disconfirmation. Coach had updated H-088.md, KE-055.md, and PRIORITY-TRACKER but missed INDEX.md.
- **Key insight from full EXP-070→073 arc**: The dominant variable is workaround availability, not externalization or binding. When workarounds are mechanically blocked (v3), everything works (100%). When they exist (v2), nothing tested closes the gap. Two distinct gap types: drift gap (fixable) vs attraction gap (fundamental). Hierarchy: mechanical enforcement > experiential feedback > instructional binding.
- **Next research directions**: (1) Mechanical enforcement on v2 (scorer rejects workarounds at implementation review), (2) Graduated workaround availability (is there a threshold?), (3) Generalization of binding to other constrained scenarios.

## Session Notes (2026-04-07 ~23:33)
- **EXP-073 COMPLETE — H-088 CONFIRMED**: 3/3 (100%) with FIX_PLAN.md binding vs. 0/6 (0%) EXP-071 control. Analysis-action gap fully closed. P(H) 0.65→0.92. KE-055 filed. All knowledge base updates complete.
- **New scenario created**: `agents/gym/scenarios/cascading-fix-trap-v2-commit/` — 3-phase task (analyze → commit → fix). 13-check scorer extends v2-ext with FIX_PLAN.md checks. Smoke-tested: 6/13 pass on unmodified environment (expected).
- **Design rationale**: EXP-071 showed 6/6 correct analysis but 0/6 correct implementation. H-088 predicts that adding a FIX_PLAN.md commitment step between analysis and implementation will close this gap. The plan requires specific file-level changes that create self-consistency pressure with the analysis.
- **Next**: Run 6 treatment sessions on cascading-fix-trap-v2-commit, score, compare against EXP-071's 0/6 pipeline reorder rate.
- **Files created**: `knowledge/experiments/EXP-073/design.md`, `gym/scenarios/cascading-fix-trap-v2-commit/` (scenario.json, task.md, success_criteria.js, environment/, package.json)
- **Files modified**: `knowledge/INDEX.md` (EXP-073 row), `knowledge/hypotheses/PRIORITY-TRACKER.md` (header, queue entry)

## Session Notes (2026-04-07 ~23:05)
- **EXP-072 KNOWLEDGE BASE INTEGRATION COMPLETE**: All 6 files updated with EXP-072 results.
- **H-085**: Status updated — boundary CONFIRMED (not just discovered). 55/60 runs pass (added EXP-072's 4/6). P(H) stays 0.92 (boundary already priced in from EXP-071). Key finding: externalization DEGRADES on workaround-resistant scenarios (100% baseline → 67% with ext).
- **H-087**: Indirect support added — scenario-level architecture (harness level) > task-level externalization for debugging. Validates the level hierarchy.
- **H-088**: P(H) 0.60→0.65. Analysis-action gap re-confirmed (2/6 v3-ext correct analysis → workaround anyway). EXP-072's "Two Competing Approaches" section updated with results.
- **KE-043**: §8 added (EXP-072 full writeup). Source/confidence line updated (9 experiments, 79+ runs). Open question 7 updated. Cross-references expanded.
- **PRIORITY-TRACKER**: Header, H-088 table entry, experiment queue all updated.
- **INDEX.md**: H-085 and H-088 entries updated. EXP-072 row added.
- **Key insight**: Scenario architecture (blocking workarounds mathematically) is the superior approach for debugging-class tasks — 100% vs 67% with externalization. But scenario architecture doesn't generalize to real tasks where workarounds can't be pre-blocked. H-088's implementation commitment remains the candidate for general-purpose analysis-action gap closure.

## Session Notes (2026-04-07 ~22:33)
- **H-088 FORMALIZED**: Implementation Commitment Externalization — closing the analysis-action gap requires fix-path externalization. P(H) = 0.60. When multiple valid fix paths exist and analysis externalization achieves correct diagnosis but not correct implementation, adding a FIX_PLAN.md commitment step (gated against the analysis) should close the gap. Five predictions: P1 (fix-path externalization closes gap on cascading-fix-trap-v2), P2 (implementation commitment independently necessary), P3 (generalizes beyond cascading-fix-trap), P4 (commitment must be specific), P5 (plan-implementation deviation predicts failure). P1 immediately testable.
- **PRIORITY-TRACKER updated**: H-088 added to Tier 2 (P(H) 0.60). Active count 15→16. Meta-process section updated.
- **INDEX.md updated**: H-088 added to hypothesis table.
- **Files created**: `knowledge/hypotheses/H-088-implementation-commitment-externalization.md`
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-07 ~22:03)
- **H-087 FORMALIZED**: Constitutional Externalization — forced externalization operates at three recursive levels (task, harness, constitution) with the same write → gate → act structure. P(H) = 0.65. Four predictions: P1 (constitutional-level externalization improves governance decisions), P2 (analysis-action gap scales with level), P3 (retrospective experiment success rate correlates with externalization completeness), P4 (removing externalization at any level degrades below it). EXP-072 tests P1/P2. P3 testable immediately from existing data.
- **PRIORITY-TRACKER updated**: H-087 added to Tier 2 (P(H) 0.65). Active count 14→15.
- **INDEX.md updated**: H-085 + H-087 both added to hypothesis table (H-085 was missing from INDEX tables).
- **Files created**: `knowledge/hypotheses/H-087-constitutional-externalization.md`
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-07 ~21:05)
- **EXP-070 numbering collision RESOLVED**: Coach committed cascading-fix-trap-v2 baselines as EXP-070 results, colliding with Bob's EXP-070 (externalization on ambiguous-context-drift). Resolution: results moved to EXP-071/baselines.md; EXP-070/results.md replaced with collision note; INDEX.md updated.
- **EXP-071 COMPLETE — BOUNDARY CONDITION FOUND**: Treatment 83% (+5.6pp from 78%). 6/6 correct root cause analysis but 0/6 pipeline reorder. First analysis-action gap.
- **New failure pattern confirmed — "workaround satisficing"**: Agent consistently finds partial workaround (threshold fix + penalties hack) instead of root cause (pipeline ordering). Externalization improves analysis quality but NOT implementation choice. Analysis-action gap is a novel boundary condition for H-085.
- **H-085 updated**: EXP-071 treatment results integrated. Boundary condition documented. P(H) reduced from 0.97 to 0.92. Formal statement's "≥90%" prediction partially falsified.
- **KE-043 updated**: §7 updated with treatment results and analysis-action gap. Open question #8 added (analysis-action gap mechanism). Cross-references updated.
- **PRIORITY-TRACKER updated**: H-085 status, P(H), and EXP-071 queue entry all updated.
- **INDEX.md updated**: EXP-071 marked complete with boundary condition summary.

## Session Notes (2026-04-07 ~14:03)
- **EXP-053 Phase 2 COMPLETE**: Retrospective natural experiment on KB growth and utilization.
  - **Citation Freshness Decay**: Strong recency bias — Era 4 entries point 85% to Era 3+ (recent), only 7% to Era 1 (foundational). Down from 66%/23% in Era 3. Hub-and-spoke structure: KE-002 (21 cites), KE-007 (13 cites), KE-001 (7 cites) dominate; 12/15 Era 1 entries avg only 1.2 citations.
  - **Cross-Reference Density**: Absolute refs increase (1.3→6.0/entry) — AGAINST H-047 prediction. But normalized density drops: 0.22→0.07→0.17→0.13. Era 2 saw sharpest decline, Era 3 recovered (topic pages + thematic clustering).
  - **Topic Index Emergence**: Created Apr 4 at KE=17, INDEX=260 lines — qualitative stress signal.
  - **Overall**: 2/4 analyses support H-047, 1 contradicts, 1 inconclusive. Pattern is "narrowing scope with compensation" not clean inverted-U.
  - **P(H) update**: H-047 0.56 → 0.62 (weakly supported).
  - **Results file**: `knowledge/experiments/EXP-053/results-phase2.md`

## Session Notes (2026-04-07 ~13:34)
- **EXP-053 Designed**: 3-phase experiment testing H-047 (Memory Lifecycle Gap — inverted-U knowledge utilization).
  - **Phase 1**: Controlled KB-size gym A/B/C test (minimal 10 entries vs full 52 entries vs curated 15 entries). 5 scenarios × 3 conditions × 3 reps = 45 runs. Tests whether more knowledge helps or hurts.
  - **Phase 2**: Retrospective natural experiment — citation freshness decay, cross-reference network density, hypothesis resolution rate, topic index emergence as stress signal. Free (~$0).
  - **Phase 3**: Minimal intervention — hide 37/52 KE entries for 5 heartbeat sessions, compare quality to 5 control sessions.
  - **Key prediction**: Condition B (full KB) ≤ Condition A (minimal KB) would confirm inverted-U. Condition C (curated) > Condition B would confirm curation > accumulation.
  - **Recommended order**: Phase 2 first (free, immediate data), then Phase 1.
- **Files created/modified**: `knowledge/experiments/EXP-053/protocol.md` (new), `PRIORITY-TRACKER.md` (EXP-053 added to queue), `INDEX.md` (EXP-053 row added), `H-047-memory-lifecycle-gap.md` (updated ownership section).

## Session Notes (2026-04-07 ~12:33)
- **Topic Pages Updated**: All 10 topic pages (01-10) updated with Knowledge Entries (KE-043+) sections. Each KE mapped to relevant topics with topic-specific annotations.
- **Coverage**: 9 KE entries (KE-043 through KE-051) cross-referenced across 10 topic pages. 21 total cross-references. Every KE appears in ≥1 page; every page has ≥1 KE.
- **Mapping**: KE-043 → 01,07,08 (forced ext); KE-044 → 03,08 (verification separation); KE-045 → 01,09 (social pathology); KE-046 → 04 (reasoning crisis); KE-047 → 07,10 (harness architecture); KE-048 → 05,06 (safety stack); KE-049 → 02,07,10 (interface formalization); KE-050 → 01,08,09,10 (robustness-architecture); KE-051 → 03,06 (self-governance).

## Session Notes (2026-04-07 ~11:33)
- **KE-050 written**: Robustness-Architecture Nexus — synthesized DD-635 (brittleness/perturbation), DD-636 (beyond fixed tests), DD-637 (self-optimizing MAS), DD-638 (subgraph sociality), CR-315. Core finding: agent robustness is determined by architecture (topology, harness, evaluation) not model capability. Robustness Stack: Topology > Harness > Evaluation > Model. Key concepts: Memorization-Robustness Inverse, 5th conformity paradox manifestation (topological). Extends KE-043/045/047.
- **KE-051 written**: Self-Governance Stack — synthesized DD-628 (self-execution simulation), DD-629 (vocabulary dropout), DD-630 (evolved UQ), CR-313. Three independently converged governance layers: L1 Self-Verification, L2 Diversity Enforcement, L3 Meta-Verification. Critical self-assessment: our system has L1 partial, L2 absent (biggest gap), L3 human-dependent. Proposes Law 50. Extends KE-038/043/044/045/047.
- **Drops processed**: All 5 files moved from drops/ to library/ (4 DDs → deep-dives/, 1 CR → cross-references/). Drops directory empty.
- **INDEX.md updated**: KE-050, KE-051 added to knowledge entries table; DD-635/636/637/638 and CR-315 added to Research Library section.

## Session Notes (2026-04-07 ~09:33)
- **Hypothesis Corpus Cleanup**: Resolved 11 hypotheses, satisfying the moratorium (required 5+). Active corpus reduced from 26 (with archived) to 15 clean, evidence-backed hypotheses.
- **Resolutions by type**:
  - ❌ **DISCONFIRMED (1)**: H-001 (adversarial QA framing — EXP-038 showed it HURT evidence discipline)
  - 📦 **SUPERSEDED (1)**: H-002 (weaker model context benefit → superseded by H-059 cadence skill)
  - 📦 **RECLASSIFIED as design principles (3)**: H-034 (session fragility), H-038 (transient skills), H-039 (decomposition bottleneck) — all true but unfalsifiable
  - 📦 **ARCHIVED for insufficient evidence (3)**: H-046 (coupled resources), H-048 (dynamic topology), H-051 (abstention R-estimator) — zero data, chain dependencies
  - 📦 **ABSORBED/MERGED (2)**: H-052 (epistemic fragility → into H-058/KE-048), H-064 (self-preservation → into H-055/H-056)
  - 📦 **OUT OF DOMAIN (1)**: H-065 (tool safety guardrails — requires model-level changes)
- **H-009 promoted to Tier 1** (P=0.85): 4 phases deployed, EXP-039 Phase B confirmed selective bias, Phase C live.
- **Moratorium lifted**: New hypotheses may be created if falsifiable, P(H) prior ≥ 0.40, connected to empirical evidence.
- **Files modified**: PRIORITY-TRACKER.md (major rewrite), H-001.md, H-002.md, H-034-session-fragility.md, H-038-transient-skill.md, H-039-decomposition-bottleneck.md, H-052-epistemic-fragility-stack.md

## Session Notes (2026-04-07 ~09:03)
- **KE-044 written**: Verification Separation Thesis — synthesized DD-523 (CORAL), DD-528 (SEVerA), DD-529 (Hermes), DD-532 (EvoSkills), DD-540 (Steve-Evolving) into a comprehensive knowledge entry on the convergent requirement that self-evolution requires architecturally separated verification.
- **Key findings**: (1) Five independent systems from 6+ institutions, 3 continents, zero shared authors converge on identical structural requirement. (2) Four distinct separation mechanisms identified: multi-agent cross-evaluation, formal contracts, information isolation, execution-layer diagnostics. (3) **Meta-insight**: verification separation IS forced externalization (KE-043) — the same mechanism operating at the meta-learning level rather than the task level. (4) Strong external validation of H-055 (Self-Improvement Paradox). (5) Five shared primitives: external verification authority, dual-track knowledge extraction, diagnostic granularity beyond binary, anti-gaming architecture, persistent accumulation with distillation.
- **INDEX.md updated**: KE-044 added to Verified knowledge entries table.
- **Unifying connection**: KE-043 (forced externalization works at task level) + KE-044 (verification separation works at evolution level) = same structural principle at different scales. Joins KE-033 (scale invariance) and KE-038 (constitutional recursion) in the multi-level enforcement family.
- **KE-045 written**: Multi-Agent Social Pathology — synthesized DD-534 (power laws/intellectual elites), DD-535 (sycophancy propagation), DD-520 (NARCBench collusion detection), DD-538 (Holos ecological MAS) into knowledge entry on emergent structural diseases in multi-agent systems.
- **INDEX.md updated**: KE-045 added to Verified knowledge entries table.
- **Three-level hierarchy complete**: KE-043 (individual task) → KE-044 (self-improvement) → KE-045 (multi-agent social). Each level has different failure modes but same structural principle: systems cannot reliably evaluate themselves without structural intervention.
- **KE-046 written**: Reasoning Depth Crisis — synthesized DD-541 (BenVanik quantitative analysis, 17,871 thinking blocks, r=0.971) and DD-556 (Claude Code Effort Crisis, 590 HN pts, Anthropic official confirmation) into knowledge entry on how reasoning budget reduction causes invisible, multiplicative quality collapse. Extends hierarchy to four levels: individual → self-improvement → social → infrastructure.
- **INDEX.md updated**: KE-046 added to Verified knowledge entries table.
- **KE-047 written**: Agent Harness Architecture Convergence — synthesized DD-517 (Raschka 6-component), DD-521/DD-524 (Imbue mngr 100+ agents), DD-530 (OpenHarness 4.8k★). Ten convergent subsystems identified: six irreducible core, one near-universal, three emerging. 1:1 mapping to software engineering patterns. Strongest validation of harness engineering thesis (H-036).
- **INDEX.md updated**: KE-047 added to Verified knowledge entries table.
- **KE-048 written**: Agent Safety Stack — synthesized DD-518 (Carlini Linux kernel CVEs), DD-526 (OpenClaw privilege escalation), DD-533 (Lean-Agent Protocol), DD-557 (Wikipedia AI Tom), DD-588 (EU law mapping). Five-layer stack: L1 Vulnerability Discovery → L2 Infrastructure Security → L3 Formal Verification → L4 Social Governance → L5 Regulatory Compliance. Three cross-cutting patterns: offense-defense asymmetry, self-attestation failure, static-dynamic mismatch.
- **INDEX.md updated**: KE-048 added to Verified knowledge entries table.
- **KE-049 written**: Agent-Environment Interface Formalization Ceiling — synthesized DD-539 (MemCoder, ICML SOTA SWE-bench), DD-542 (MatClaw 4-layer memory), DD-543 (Schema-First Tool APIs), DD-566 (Agent HTTP behavioral signatures). Core finding: structural formalization eliminates mechanical errors but leaves reasoning errors untouched. Six-level formalization ladder; ceiling between L2 (diagnostics) and L3 (semantic constraints). All 24 previously-unreferenced DDs now covered by KE entries.
- **INDEX.md updated**: KE-049 added to Verified knowledge entries table.

## Session Notes (2026-04-07 ~08:04)
- **KE-043 written**: Forced Externalization — The Complete Empirical Picture. Synthesized EXP-045 through EXP-049 into a comprehensive knowledge entry covering all five experiments, four failure domains, and the unified mechanism model.
- **Key contributions**: (1) Unified evidence stack: 60+ runs, 100% ext pass rate vs 0-50% baselines across tunnel vision, sycophancy, contradiction blindness, and proxy-satisfying behavior. (2) Mechanism definitively identified as "analysis activation" (behavioral mode shift), NOT content provision, commitment, or anchoring. (3) Intervention hierarchy formalized: reward shaping (0%) < text skills (0%) < hard workflow (100%). (4) Integrates KE-029 through KE-036 + KE-041 into single reference. (5) Five open questions identified for future work.
- **INDEX.md updated**: KE-043 added to Verified knowledge entries table.

## Session Notes (2026-04-07 ~06:33)
- **KE-041 written**: Structural Constraint and Stigmergic Coordination — synthesized DD-589 (C-MADF causal cyber defense) and DD-594 (Ledger-State Stigmergy) into a knowledge entry identifying two dual design primitives.
- **Key findings**: (1) Forced externalization IS causal action-space restriction (DD-589) — both work by eliminating invalid options, not discouraging them. Hierarchy: reward shaping (0%) < text rules (0%) < soft workflows (partial) < hard gates (100%) < full action-space restriction (6.2× FPR↓). (2) Our knowledge base IS stigmergic coordination (DD-594) — agents modify shared environment, others read and respond, no direct messaging. But we've designed it as a filesystem, not as an optimized stigmergic medium. (3) Behavioral Divergence Score proposed as runtime R-estimator from DD-589's dual-policy architecture. (4) Configurable decay needed — DD-594 predicts H-047 inverted-U from a second theoretical tradition. (5) Candidate H-090 proposed (stigmergic coordination advantage) — deferred per moratorium.
- **INDEX.md updated**: KE-041 added to knowledge entries table; DD-589, DD-594 added to Research Library.
- **13th-14th independent convergences** on structural enforcement thesis (from adversarial cybersecurity and biological coordination theory).

## Session Notes (2026-04-07 ~05:33)
- **KE-040 written**: Memory Architecture Convergence — synthesized DD-590/591/592/593 into a knowledge entry on active memory substrate. Five shared primitives identified across four independent systems: write-gating, consolidation/forgetting, active middleware, hybrid retrieval, role-aware routing.
- **INDEX.md updated**: KE-040 added to knowledge entries table; DD-590/591/592/593 added to Research Library.
- **Key insight**: Passive storage is the fundamental failure mode — all four papers independently converge on memory as an active computational layer, not a retrieval database. This extends WKWA-004 and directly addresses H-043 utilization bottleneck.

## Session Notes (2026-04-04 ~14:15)
- **Bayesian Hypothesis Scoring**: Applied continuous P(H) scores to all 23 active hypotheses. Created SCORECARD-bayesian-2026-04-04.md with full methodology.
- **Results**: 3 high confidence (H-055, H-053, H-059), 8 moderate, 7 low, 4 archive candidates.
- **H-066 created**: Bayesian Belief Management hypothesis — the meta-process for managing the corpus. P1 confirmed (7 hypotheses below 0.40, predicted ≥5).
- **PRIORITY-TRACKER updated**: All tiers now use quantitative P(H) scores instead of qualitative labels. Active count reduced from 23→17. Moratorium enforced (H-060-065 triaged).
- **Key contradiction surfaced**: H-060 (hierarchy > flat) vs H-061 (constrained communication helps flat). Needs resolution.
- **CR#279 actions**: Bayesian belief updates and progressive evidence requirements now DONE. 2/5 completed this session.

## Session Notes (2026-04-04 ~13:45)
- **Memory Architecture Stack synthesis**: Connected DD#501-504 to H-043. Proposed 4-layer architecture (Gating → Store Typing → Governance → Role Routing). Added to INDEX.
- **New material absorbed**: DD#501-511, CR#279, KE-018/019, H-059-065, HB-0119-0125, HB-250409-250414. Rich batch focused on memory architectures, belief management, and sycophancy.
- **Key insight**: Knowledge utilization is a delivery problem, not a production problem. Four independent ICLR 2026 research groups confirm.
- **BACE connection**: DD#511 provides the technical blueprint for Bayesian hypothesis confidence scoring. Directly implements CR#279's recommendation.

## Session Notes (2026-04-04 ~06:45)
- **Materialization Paradox identified**: EXP-022 breaks KE-002's 0/20 barrier. Cadence skills ≠ judgment skills.
- **New cross-ref written**: `cross-ref-materialization-paradox.md` — highest-value synthesis this session.
- **Hypothesis files**: All 36 scanned at title/status level. H-055 (Self-Improvement Paradox) and H-053 (Workflow Adoption Decay) are the strongest hypotheses, both with rich empirical data.
- **Phase 2 Knowledge Compilation**: Completed last session — 10 topic index files live.

## Session Notes (2026-04-07 ~19:34)
- **EXP-070 DESIGNED**: Externalization treatment on ambiguous-context-drift (EXP-068's first non-ceiling injected_context scenario, baseline 67%). Phase 1: extended baseline N=10. Phase 2: treatment N=10. Phase 3: diagnostic analysis. Tests whether H-085 can close the documentation-parroting gap.
- **H-019 UPDATED**: Added DD#570 (SKILL0 deep-dive) evidence — confirms skill internalization maps to tiered memory architecture. Dynamic curriculum = automated consolidation scheduler. Challenges harness-only optimization thesis.
- **Deep-dives absorbed**: DD-569 (御舆 Claude Code book — 420K words, 5th harness engineering convergence), DD-570 (SKILL0 internalization), DD-584 (Springdrift — 7th harness convergence from systems engineering angle). All already in library; connections noted.
- **Contradiction resolution forked**: Session s_1775590562260_313 handling the 9 actions from CONTRADICTION-ANALYSIS-2026-04-07.md.
- **EXP-070 empty placeholder filled**: Was just an empty directory; now has design.md with full experiment protocol.
- **State assessment**: H-085/KE-043 already up-to-date (Coach integrated EXP-069 N=48/48). Priority tracker current. 5 new deep-dives in library but no new KE entries needed yet (DD-569/570/584/585/589 — connections to existing entries noted).

## Session Notes (2026-04-07 ~16:03)
- **KE-053 WRITTEN**: Synthesized EXP-065 (production-gym gap analysis, N=893 errors) + EXP-066 (compound verification ceiling 3/3) into new knowledge entry.
- **Core finding**: Gym-production gap is structural, not behavioral. Three gaps: context scale (11,229 vs 3-12 files), instruction complexity (multi-page vs clean 5-20 line), compound verification (implicit vs explicit deps).
- **Critical insight**: FM-3.3 (#1 failure mode, 165 entries, 18.5%) is behavioral — agents CAN verify but don't CHOOSE to. Gym auto-forces correct behavior; production doesn't.
- **Gym graduation**: With 96% ceiling, gym is now a regression suite, not a training tool.
- **INDEX updated**: Added KE-052 + KE-053 entries and EXP-065 + EXP-066 experiment rows.
- **Connections**: KE-053 extends KE-052 (structural access thesis), confirms KE-013 (task boundedness), extends KE-043 (forced externalization explains the gap).

## Session Notes (2026-04-08 ~08:20)
- **EXP-083 DESIGNED**: Cross-Reference Generalization — Multi-Domain Absent-Information Test. Tests H-089 P1: does cross-reference intervention generalize beyond config repair?
- **Two new scenarios built**: (1) `truncated-env-repair` — .env file truncated, 6 visible + 2 silent env vars discoverable from source. (2) `truncated-schema-migration` — DB schema truncated, visible columns from tests + 2 silent columns from model code.
- **Treatment variants built**: `truncated-env-repair-xref` and `truncated-schema-migration-xref` with injected cross-reference skill.
- **Protocol**: N=6 baseline + N=6 treatment per scenario (24 total runs). Success = ≥50% improvement on silent checks in BOTH scenarios.
- **Delegated to Coach**: P1 message sent for Phase 1 baselines (12 runs).
- [x] **EXP-083 Phase 1 baselines**: COMPLETE. 12 baseline runs confirm 100% visible / 0% silent across both domains.
- [x] **EXP-083 Phase 2 treatment**: COMPLETE. 12 treatment runs: 24/24 silent + 48/48 visible (100%). H-089 P1 CONFIRMED.

## Session Notes (2026-04-08 ~11:50)
- [x] **KE-060 WRITTEN**: Unified Agent Intervention Taxonomy — The Three Mechanisms. Synthesizes H-085 (Analysis Activation/M1), H-089 (Evidence Discovery/M2), H-091 + KE-056 (Structural Constraint/M3) into complete diagnostic framework. 200+ runs across 40+ experiments. Includes diagnostic decision tree, 2×2 matrix (information × solution space), refined delivery hierarchy (L0–L5), and analysis-action gap boundary. Six open questions identified for future work.
- **EXP-085 COMPLETE and integrated** (few-shot generalization: 100% on escalation-judgment). EXP-070 still DESIGNED/unrun.
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift baseline 67%), (2) ~~Consider EXP-086: test few-shot with structurally dissimilar example to map boundary of structural similarity effect.~~ **DONE**

## Session Notes (2026-04-08 ~13:14)
- [x] **EXP-086 INTEGRATED into knowledge base**: Mismatched few-shot boundary test — 2/3 (66.7%) vs matched 3/3 (100%) vs baseline 12.5%. Two-level transfer model established. Updated: H-091 (P(H) 0.88→0.90), KE-059 (two-level transfer), INDEX.md (EXP-086 row + KE-059/KE-060/H-091 summaries), PRIORITY-TRACKER (H-091 entry + EXP-086 row).

## Session Notes (2026-04-08 ~14:20)
- [x] **GYM FAILURE REMEDIATION STRATEGY WRITTEN**: Comprehensive synthesis mapping all 30 failing gym scenarios to KE-060 mechanisms (M1/M2/M3). Key findings:
  - M1 (Analysis Activation) dominates: 16/30 (53%) of failures
  - M2 (Evidence Discovery): 4/30 (13%)  
  - M3 (Structural Constraint): 5/30 (17%)
  - Model-level limitations: 3/30 (10%)
  - Rubric/noise: 2/30 (7%)
  - 83% of failures (25/30) addressable with known mechanisms
  - Phase 1 deployment (reuse existing skills) estimated to raise pass rate from 72% → 80%
  - Full deployment path to ~90% pass rate documented
- **Files created**: `agents/shared/knowledge/synthesis/gym-failure-remediation-strategy.md`
- **INDEX.md updated**: Added link to remediation strategy
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift), (2) Begin Phase 1 deployment — sycophants-dilemma few-shot skill + cross-reference for prerequisite detection

## Session Notes (2026-04-08 ~14:35)
- [x] **EXP-089 INTEGRATED into knowledge base**: Combined few-shot + checklist = 4/6 (67%) synergistic on contradictory-requirements. Exceeds both individual treatments (few-shot 33%, checklist 0%). Hierarchy validated: baseline 0% < checklist 0% < few-shot 33% < combined 67% < workflow 100%. Updated: H-091 (P(H) 0.92→0.94), KE-059 (synergistic combination section), KE-060 (mechanism composition section), INDEX.md (EXP-089 row), PRIORITY-TRACKER (updated header + H-091 entry).
- **EXP-088 DESIGNED** (not yet run): Workaround Difficulty Gradient — tests L2↔L4 transition. Tests whether making workarounds harder (not impossible) enables binding+externalization to produce correct fixes. Design in experiments/EXP-088/design.md.
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift), (2) Begin Phase 1 deployment — sycophants-dilemma few-shot skill + cross-reference for prerequisite detection, (3) Run EXP-088 (workaround difficulty gradient)

## Session Notes (2026-04-08 ~15:09)
- [x] **EXP-087 INTEGRATED into knowledge base**: Few-shot on sycophants-dilemma — 3/3 (100%) vs 67% baseline. Domain-matched few-shot closes the gap completely. Updated: H-091 (EXP-087 in evidence list, combined stats 9/9), KE-059 (EXP-087 source + delivery vector insight), INDEX.md (EXP-087 row), PRIORITY-TRACKER (H-091 P(H) updated).
- **EXP-070 dispatched to Coach**: P1 message sent — externalization on ambiguous-context-drift, overdue since April 7. Phase 1 (N=10 baseline) + Phase 2 (N=10 treatment).
- **EXP-088 in progress**: Coach currently running workaround difficulty gradient experiment.
- **Next priorities**: (1) Await EXP-070 + EXP-088 results, (2) Begin Phase 1 deployment — embed few-shot skills into coder's default context for matching scenarios, (3) Design next experiments from remediation strategy

## Session Notes (2026-04-08 ~15:35)
- [x] **EXP-088 integration**: COMPLETE — Workaround Difficulty Gradient results integrated into knowledge base.
  - **Key findings**: Baseline 2/3 (67%) correct pipeline fix with hard workaround, treatment 3/3 (100%). v2 combined (0/18) vs v2-hard combined (5/6): p<0.001. Difficulty gradient exists — it's not binary (available vs impossible) but continuous based on relative difficulty.
  - **Most impactful implication**: We don't need to eliminate workarounds entirely — just make the correct fix easier than the workaround.
  - **H-088 updated**: Status → CONFIRMED WITH GRADIENT. P(H) 0.70→0.80. EXP-088 evidence section added. Promoted to Tier 1 in PRIORITY-TRACKER.
  - **KE-056 updated**: Open Question #1 (difficulty gradient) ANSWERED. New intermediate hierarchy levels (L3/L3.5) documented. EXP-088 added to cross-references and source line.
  - **KE-060 updated**: Open Question #6 (workaround difficulty gradient) ANSWERED. M1/M3 boundary refined — relative difficulty determines which mechanism is needed. EXP-088 update section added.
  - **INDEX.md updated**: EXP-088 experiment row added (COMPLETE). KE-056 summary updated with gradient finding. H-088 summary updated (P(H)=0.80). EXP-088 KE entry updated (DESIGNED→COMPLETE).
  - **PRIORITY-TRACKER updated**: Header mentions EXP-088 COMPLETE. H-088 moved from Tier 2 (0.70) to Tier 1 (0.80). EXP-088 added to experiment queue (COMPLETE). Meta-process section updated (12→11 high confidence count adjusted, H-088 promoted).
  - **Files modified**: H-088.md, KE-056.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-08 ~16:35)
- [x] **EXP-090 integration**: COMPLETE — Few-Shot Skill Conversion Sprint 1 results integrated into knowledge base.
  - **Key findings**: Both know-when-blocked (escalation-impossible-task) and evidence-over-narrative (misleading-test-fix) achieved 0%→100% with domain-matched few-shot worked examples. Cumulative matched few-shot: 12/12 (100%) across 5 scenarios.
  - **H-091 updated**: P(H) 0.92→0.98. EXP-090 evidence section added. Status updated to include EXP-090.
  - **KE-059 updated**: Source line updated with EXP-090. Confidence note added. Full EXP-090 evidence section with per-skill results.
  - **KE-060 updated**: Experiment range updated to EXP-090. EXP-090 update section added (L3 few-shot production-ready).
  - **INDEX.md updated**: EXP-090 experiment row added. KE-060 summary updated (12/12 matched few-shot, 220+ runs, EXP-090 range).
  - **PRIORITY-TRACKER updated**: Header updated with EXP-090 COMPLETE. H-091 row updated (P(H)=0.98, EXP-090 evidence). EXP-090 added to experiment queue. Meta-process H-091 confidence updated.
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md
- [x] **Gym failure remediation strategy update**: COMPLETE — gym-failure-remediation-strategy.md updated with EXP-090 findings.
  - **escalation-impossible-task reclassified**: Was "Model-Level Limitation" → now "M1: Analysis Activation — SOLVED by few-shot". EXP-090 proved 0/3→3/3 (100%).
  - **misleading-test-fix added**: New scenario #31, also SOLVED by few-shot (evidence-over-narrative, 0/3→3/3).
  - **Executive Summary updated**: M1 count 16→18, Model-Level 3→2, total scenarios 30→31. Addressable failures 83%→87%.
  - **Mechanism Distribution updated**: Reflects reclassification and new scenario.
  - **Deployment Priority updated**: Phase 1 now includes 3 proven few-shot deployments (trivial effort).
  - **New "Validated Interventions" section**: 7 experimentally confirmed skill→scenario pairs with effect sizes and p-values.
  - **Cross-References updated**: EXP-090 added, H-091 P(H) updated.
  - **Files modified**: gym-failure-remediation-strategy.md, todo.md
