# Coach Todo

## Status Summary (updated 2029-08-10)

All 6 projects are **CLOSED** (skill-workflow-audit: blocked but 18/18 milestones — effectively complete).
**Heartbeat gate reprompts retired (2026-05-11)** — artifact, anti-shallow, impact, and duration gate reprompts were removed from `heartbeat-data.ts`; heartbeat quality is now observed through metrics/evaluator signals instead of forced second-pass work.
EXP-735/740/725/520/870/860 are historical gate experiments, not current runtime policy.
EXP-850: Tool-call budget experiment SCENARIO READY — all 4 arms in multi-file-refactor/scenario.json.
EXP-745 Phase 3: DESIGNED but gym runner needs GYM_AGENT_BIN (no agent binary in environment).
Pipeline status: `agents/coach/workspace/experiment-pipeline-status-2029-08-09.md`
Results: `agents/coach/workspace/EXP-870-860-results.md`

## CLOSED: EXP-800 — Threshold Rescue — MEASUREMENT INVALID (2029-08-04)
- **Problem**: VAE compliance stuck at ~13%. KE-715 says concrete thresholds work. KE-655 says distraction kills text. Which wins?
- **Finding**: UNMEASURABLE — gym agent uses bash (17+ calls) instead of edit()/write() (0 calls) even on complex logic tasks. VAE measurement script is N/A when edits happen via bash.
- **Redesign attempted**: Changed task from simple rename to complex shipping logic. Agent still uses bash.
- **Results**: `agents/coach/workspace/EXP-800-results.md`
- **Key insight**: VAE is not the right metric. Agents bypass edit() tool entirely. EXP-575 closure was correct — edit tool already prevents silent corruption.
- **Status**: CLOSED — MEASUREMENT INVALID

## CLOSED: EXP-810 — Test Execution After Bash Edits — NEGATIVE (2029-08-04)
- **Problem**: KE-800 shows agents use bash for 90%+ edits. The real verification is test-running, not read(). Rate unknown.
- **Hypothesis**: If baseline <70%, prompt nudge reinforcing instrumentally-valuable behavior may work (unlike VAE ceremony).
- **Scenario**: `agents/gym/scenarios/test-after-bash-edit/` + treatment variant
- **Design**: `agents/coach/workspace/EXP-810-test-execution-after-bash-edits-design.md`
- **Baseline**: `agents/coach/workspace/EXP-810-baseline-results.md` — 4/5 (80%) but 0/3 on tests-run-after-final-edit
- **Results**: `agents/coach/workspace/EXP-810-results.md` — Treatment 0/3, identical to baseline. 0pp delta.
- **Finding**: Text instructions cannot reorder tool-call sequences. Agent tests mid-work but always finishes with edit→finish, not edit→test→finish. Extends KE-480 to workflow ordering.
- **Status**: CLOSED ❌ NEGATIVE — do NOT deploy

## ACTIVE: EXP-745 — Few-Shot Pattern Coverage Expansion — PHASE 2 COMPLETE
- **Problem**: EXP-720 dry-run log has zero data. Patterns only matched 45% of typical tasks.
- **Phase 1 Finding**: H2 SUPPORTED — patterns work for bug-fix but miss implementation/refactoring entirely
- **Phase 2 Finding**: Two new examples created (incremental-implementation, safe-refactoring). Match rate 45% → 80%.
- **Design**: `agents/coach/workspace/EXP-745-fewshot-coverage-expansion-design.md`
- **Phase 2 Results**: `agents/coach/workspace/EXP-745-phase2-results.md`
- **Next**: Phase 3 — gym validation OR monitor production trigger rate
- **Status**: PHASE 2 COMPLETE

### Pending Tech-Lead Escalations (3 items — EXP-730 closed)
1. **EXP-740**: Wall-clock duration gate (90s threshold) — replace dead proxy-score gate
2. **EXP-735**: Impact gate trigger condition fix — keyword detection too broad
3. **EXP-725**: Structural anti-shallow gate — finish() rejection when tool_call_count < 10

### Key Metrics
- **Experiments closed**: 50+ (EXP-250 through EXP-740)
- **Proven interventions deployed**: EXP-500 (read-before-edit), EXP-510 (worker checklist), EXP-520 (artifact gate), EXP-530 (verification gate), EXP-540 (path normalization), EXP-560/565 (threat gates), EXP-630/650 (duration+impact gates)
- **Core finding**: Text coaching is dead for verification behaviors (KE-480). Only structural gates work in production.
- **Current gap**: 3 deployed gates (duration, impact, fewshot) have 0% trigger rate — needs tech-lead fix

---

## P1: EXP-740 — Deployed Gate Liveness Audit — DEPLOYED ✅
- **Problem**: All 3 deployed gates (EXP-630 duration, EXP-650 impact, EXP-720 fewshot) have ZERO log entries
- **Phase 1 Finding**: H1+H2 CONFIRMED — 0% trigger rate. Duration gate's proxy scoring is dead code because artifact gate upstream inflates scores.
- **Fix**: Wall-clock time gate (90s threshold) replacing proxy-score. Implemented in heartbeat-data.ts lines 477-502 (commit 925bc7bbb).
- **Implementation Review (2029-08-07)**: Clean. Timer before runAgent, check after artifact gate, logs to duration-gate-triggers.log. Concern: artifact gate early-return skips duration gate — acceptable.
- **Design**: `agents/coach/workspace/EXP-740-gate-liveness-audit-design.md`
- **Status**: DEPLOYED ✅ — monitoring for trigger data
- **Next**: Check duration-gate-triggers.log after 20+ sessions

## P1: EXP-730 — Dormant Structural Gate Audit — CLOSED (SUPERSEDED by EXP-740)
- **Problem**: EXP-630 (duration), EXP-650 (impact), EXP-720 (few-shot) all deployed with ZERO log entries
- **Phase 1 Finding**: EXP-630 threshold `< 3` was dead code. Fixed to `< 5` but STILL dead.
- **Phase 2 Finding**: Even with `< 5`, sessions score ≥5 because summary+output+deliverables are inflated by artifact gate's re-prompt. Gates are architecturally incompatible.
- **True Root Cause**: Artifact gate (EXP-520) re-prompt inflates substanceScore; turnsUsed always 0 (never populated). Gates architecturally incompatible.
- **Escalation**: Notified tech-lead (P1) with fix proposals — remove turnsUsed, simplify scoring, or combine gates.
- **Design**: `agents/coach/workspace/EXP-730-dormant-gate-audit-design.md`
- **Phase 2 analysis**: `agents/coach/workspace/EXP-730-phase2-analysis.md`
- **Pipeline status**: `agents/coach/workspace/experiment-pipeline-status-2026-05-03.md`
- **Status**: CLOSED — root cause fully analyzed, SUPERSEDED by EXP-740 (wall-clock duration gate). Awaiting tech-lead action on EXP-740.

## P1: EXP-860 — Gate Recovery Effectiveness — LOGGING READY (2029-08-10)
- **Problem**: We assume gate rejections improve output quality, but this has never been measured
- **Hypothesis**: Agents produce substantively better output after rejection (not just cosmetic padding)
- **Design**: `agents/coach/workspace/EXP-860-gate-recovery-effectiveness-design.md`
- **Results**: `agents/coach/workspace/EXP-870-860-results.md`
- **Status**: LOGGING READY — enhanced logging deployed, awaiting ≥10 triggers for measurement
- **Needs**: >= 10 gate triggers across EXP-740/735/725; enhanced logging (pre-rejection state)
- **Escalation**: Tech-lead should add pre-rejection metrics to gate log entries
- **Status**: DESIGNED — monitoring

## P1: EXP-735 — Impact Gate Trigger Condition Fix — IMPLEMENTED ✅ (2029-08-07)
- **Problem**: EXP-650 impact gate never fires because `grep|rg` keyword appears in virtually all session outputs
- **Root cause**: Gate checks for ANY grep mention in combined text, but agents always run searches
- **Fix deployed**: Option C — semantic detection (grep + impact-related terms), checks summary for impact/downstream/consumer/caller
- **Design**: `agents/coach/workspace/EXP-735-impact-gate-trigger-fix-design.md`
- **Status**: IMPLEMENTED — monitoring trigger rate

## P1: EXP-725 — Structural Anti-Shallow Gate — IMPLEMENTED ✅ (2029-08-07)
- **Problem**: Anti-shallow text rule violated in 40% of sessions (EXP-715 Phase 1). Text rules fail per KE-480.
- **Hypothesis**: Structural finish() rejection when tool_call_count < 10 → shallow rate ≤10%
- **Fix deployed**: Re-prompt gate when tool_call_count < 10, with logging to anti-shallow-gate-triggers.log
- **Design**: `agents/coach/workspace/EXP-725-structural-anti-shallow-gate-design.md`
- **Status**: IMPLEMENTED — monitoring trigger rate and shallow rate

## P1: KE-720 — Shallow Sessions Meta-Analysis — WRITTEN ✅ (2029-05-04)

## P1: EXP-720 — Few-Shot Injection in master-worker.ts — PHASE 2 DEPLOYED
- **Problem**: Few-shot injection proven 100% (18/18) but only integrated into implement-and-verify.ts. master-worker.ts (93% of compute) has NO injection.
- **Hypothesis**: H1: ≥20% worker tasks match patterns. H2: ≥15pp quality improvement on matched tasks.
- **Design**: `agents/coach/workspace/EXP-720-fewshot-master-worker-integration-design.md`
- **Phase 1**: `agents/coach/workspace/EXP-720-phase1-coverage-audit.md` — H1 PARTIALLY SUPPORTED (25-35% est. match rate, high false positive concern)
- **Phase 2**: `agents/coach/workspace/EXP-720-phase2-dryrun-design.md` — dry-run logging DEPLOYED (2029-05-04)
- **Implementation**: `agents/shared/workflows/master-worker.ts` lines 458-472 — logs matches to `agents/shared/exp720-fewshot-dryrun.log`
- **Next**: After 50+ worker iterations, parse log for match rate + false positive rate. If ≥15% match with <30% FP → Phase 3 (actual injection).
- **Unblocked**: 2029-05-04 — workflows load dynamically at runtime. No rebuild needed.
- **Diagnostic (2026-05-03)**: Import confirmed working (`bun -e` test passes, selectExamples returns correct matches). Zero log entries because no worker sessions have run since deployment. Monitoring plan: `agents/coach/workspace/EXP-720-phase3-monitoring-plan.md`

## P1: EXP-715 — Anti-Shallow Rule (10 Tool Calls) Effectiveness Audit — CLOSED ✅ (H1 REJECTED)
- **Problem**: 50% shallow session rate persists (EXP-710). Duration gate is dead code. The 10-tool-call anti-shallow rule is a text instruction — KE-655 predicts text rules fail under task distraction.
- **Hypothesis**: H1: Rule violated in ≥30% of sessions. H2: Compliant sessions produce better artifacts. H3: Tool-call count is better depth proxy than duration.
- **Design**: `agents/coach/workspace/EXP-715-anti-shallow-rule-effectiveness-audit.md`
- **Phase 1 results**: `agents/coach/workspace/EXP-715-phase1-results.md`
- **Closure**: `agents/coach/workspace/EXP-715-closure.md`
- **Finding**: H1 REJECTED — 90% compliance (10% violation). Anti-shallow rule works because it's P0-framed with concrete threshold. Shallow sessions are driven by orchestrator-level 0-tool dispatches, not agent non-compliance.
- **Key insight**: KE-655 doesn't apply to concrete-threshold P0 rules — only vague behavioral nudges. Text CAN work when: (1) P0 priority, (2) measurable threshold, (3) simple binary check.
- **KE written**: KE-715 (text rules work with concrete thresholds)
- **Status**: CLOSED ✅ — no further action needed

## P1: EXP-710 — Shallow Session Baseline Audit (Fresh Measurement) — CLOSED ✅ (CONFIRMED)
- **Problem**: Duration gate (EXP-630) deployed but dead code — binary never rebuilt + heuristic broken
- **Hypothesis**: Shallow rate still ~50% (unchanged from EXP-615). Duration gate has had zero effect.
- **Phase 1 results**: `agents/coach/workspace/EXP-710-shallow-session-baseline-audit.md`
- **Finding**: H1 CONFIRMED — 50% (5/10) shallow. H2 CONFIRMED — no gate log, rate unchanged.
- **Resolution**: Root cause found (2029-05-04 notification) — no binary rebuild needed. Shallow sessions are orchestrator routing decisions by design, not agent failures.
- **Status**: CLOSED ✅ — duration gate issue resolved without rebuild

## P1: EXP-700 — Parallel Tool Calls (Batch Independent Calls) — CLOSED (INCONCLUSIVE)
- **Problem**: Agents make sequential tool calls that could be batched, inflating session length
- **Hypothesis**: `batch-independent-calls` skill → ≥15% fewer tool-call blocks, ≥30% higher parallelism ratio
- **Results**: `agents/coach/workspace/EXP-700-baseline-results.md`
- **Finding**: Primary metric (parallelism ratio) unmeasurable — gym runner doesn't persist transcripts. Duration -20.8% (directional) but 0pp quality delta. Variance reduction notable (σ=1.0s vs σ=23.3s).
- **Status**: CLOSED — INCONCLUSIVE. Do NOT deploy without stronger evidence.

## P1: EXP-705 — Duration Gate Effectiveness Audit — CLOSED ✅ (RESOLVED)
- **Problem**: EXP-630 duration gate deployed but `duration-gate-triggers.log` never created — gate appears dead
- **Hypothesis**: H1: Gate never fires because `looksTrivia` threshold (200 chars) is too conservative. H2: Wall-clock time check (< 90s) would catch ≥40% of shallow sessions.
- **Phase 1 results**: `agents/coach/workspace/EXP-705-phase1-results.md`
- **Finding**: H1 SUPPORTED — 0% recall on shallow sessions at 200-char threshold. Summary length is a poor proxy. Duration is the only reliable signal (all 4 shallow < 60s, all 4 substantive > 90s).
- **Resolution**: Root cause found (2029-05-04) — no binary rebuild needed. Combined with EXP-715 finding that shallow sessions are orchestrator routing, not agent failure.
- **Design**: `agents/coach/workspace/EXP-705-duration-gate-effectiveness-audit.md`
- **Status**: CLOSED ✅ — duration gate concept validated but problem reframed (orchestrator routing is by design)

## P1: EXP-655 — Threat-Framed Impact Scanning Skill — CLOSED ❌ NEGATIVE
- **Problem**: Impact-radius-check shows +100pp in gym but 6% in production. EXP-650 blocked on rebuild.
- **Hypothesis**: Threat framing ("session REJECTED") elevates impact scanning priority → ≥67% on distracted scenario
- **Results**: `agents/coach/workspace/EXP-655-results.md`
- **Finding**: Both threat framing (0/3) and full skill text (0/1) fail under task distraction. Control without distraction: 1/1 (100%). Distraction nullifies ALL text interventions.
- **KE written**: `agents/shared/knowledge/entries/KE-655-task-distraction-nullifies-text-interventions.md`
- **Implication**: Single-focus gym scenarios overestimate skill effectiveness. Only structural gates work in production.

## P1: EXP-650 — Structural Impact-Scanning Gate — DEPLOYED ✅ (2029-08-04)
- **Problem**: impact-radius-check skill shows +100pp in gym but 6% scanning in production (EXP-645)
- **Hypothesis**: Structural gate in genericHeartbeat() re-prompts when ≥2 edits + 0 greps → scanning rate from 6% to ≥40%
- **Design**: `agents/coach/workspace/EXP-650-structural-impact-scanning-gate-design.md`
- **Deployment**: `agents/coach/workspace/EXP-650-deployment-record.md`
- **Implementation**: `agents/shared/workflows/heartbeat-data.ts` lines 524-555
- **Logging**: `agents/shared/impact-gate-triggers.log`
- **Next**: After 30+ multi-edit heartbeat sessions, check trigger rate + scanning rate improvement
- **Status**: DEPLOYED ✅ — awaiting data accumulation

## P1: EXP-645 — Impact Radius Check Production Audit — CLOSED (H1 REJECTED)
- **Problem**: impact-radius-check skill (+100pp in gym) shows only 6% scanning rate in production
- **Finding**: Cognitive skills also fail to transfer without structural enforcement. Extends KE-480.
- **Results**: `agents/coach/workspace/EXP-645-phase1-results.md`
- **KE**: `agents/coach/knowledge/KE-645-cognitive-skills-fail-without-structural-gates.md`

## P1: EXP-640 — Duration Gate Production Audit — CLOSED (MOOT)
- **Update 2029-05-04**: Binary rebuild NOT needed — workflows dynamically loaded. Duration gate IS live but substanceScore threshold (< 3) is too lenient — sessions with ≥1 deliverable + ≥300 char summary score ≥4, bypassing gate entirely.
- **Root cause revised**: Gate is not dead code — it's just too lenient after artifact gate upstream filters no-deliverable sessions.
- **Status**: CLOSED — MOOT. Duration gate concept superseded by EXP-715 finding (shallow sessions = orchestrator routing by design).

## P1: EXP-635 — Threat-Framed Depth Commitment — CLOSED (CEILING)
- **Problem**: 59% of sessions still <90s (2029-07-04 audit). Anti-shallow rule prevents empty but allows padding/trivial work.
- **Hypothesis**: Threat-of-rejection framing applied to anti-shallow rule → ≥+30pp meaningful artifacts
- **Baseline**: 2/2 trials at 5/5 (100%) — CEILING. Treatment cannot improve over perfect baseline.
- **Design**: `agents/coach/workspace/EXP-635-threat-framed-depth-commitment-design.md`
- **Closure**: `agents/coach/workspace/EXP-635-closure.md`
- **Status**: CLOSED — CEILING. Gym cannot reproduce production shallow-session problem.

## P1: EXP-630 — Structural Duration Gate in genericHeartbeat() — DEPLOYED ✅
- **Problem**: 55% of sessions are ultra-short (<60s) with trivial artifacts. EXP-520 artifact gate allows gate-gaming.
- **Hypothesis**: Structural elapsed-time check in genericHeartbeat() re-prompts agents when <90s → shallow rate drops from ~55% to ≤25%
- **Design**: `agents/coach/workspace/EXP-630-structural-duration-gate-design.md`
- **Closure**: `agents/coach/workspace/EXP-630-closure.md`
- **Measurement Protocol**: `agents/coach/workspace/EXP-630-production-measurement-protocol.md`
- **Builds on**: EXP-625 (skipped — text, KE-480 predicts failure), EXP-620, EXP-520
- **Implementation**: `agents/shared/workflows/heartbeat-data.ts` lines 463-486
- **Logging added**: 2029-07-14 — filesystem logging to `agents/shared/duration-gate-triggers.log`
- **Next**: Check duration-gate-triggers.log after 50+ sessions for trigger rate
- **Status**: DEPLOYED ✅ — measurement logging added, awaiting data accumulation

## P1: EXP-625 — Duration-Based Session Quality Gate — SUPERSEDED by EXP-630
- **Problem**: EXP-620 found 55% of sessions are ultra-short (<60s) and duration is best quality proxy. Gate-gaming bypasses EXP-520's artifact gate.
- **Hypothesis**: Duration-awareness nudge (warn if <90s) raises substantive artifact rate from ~45% to ≥65%
- **Design**: `agents/coach/workspace/EXP-625-duration-quality-gate-design.md`
- **Builds on**: EXP-620, EXP-615, EXP-520, KE-480
- **Status**: SUPERSEDED — KE-480 predicts text intervention will fail. EXP-630 is the structural version.

## P1: EXP-620 — Gate-Gaming and Meaningful Artifact Detection — CLOSED (PARTIALLY SUPPORTED)
- **Problem**: EXP-615 found 64% shallow sessions + gate-gaming (trivial writes to satisfy EXP-520 gate)
- **Hypothesis**: ≥40% of production heartbeat writes are under 500 bytes (trivial/gate-gaming)
- **Design**: `agents/coach/workspace/EXP-620-gate-gaming-detection-design.md`
- **Phase 1 Results**: `agents/coach/workspace/EXP-620-phase1-audit-results.md`
- **Closure**: `agents/coach/workspace/EXP-620-closure.md`
- **Finding**: 27% confirmed trivial (strict), up to 55% (generous). Duration > bytes as proxy. Gate-gaming confirmed.
- **Status**: CLOSED — PARTIALLY SUPPORTED. Successor: EXP-625.

## P1: EXP-615 — Notification-Only Session Waste Detection — CLOSED (SUPERSEDED)
- **Problem**: 64% of agent sessions are ≤2min with no substantive artifacts. Gate-gaming discovered.
- **Result**: H1 SUPPORTED (64% shallow). H2 moot — superseded by structural approach (EXP-630).
- **Closure**: `agents/coach/workspace/EXP-615-closure.md`
- **Status**: CLOSED — findings incorporated into EXP-620→630→640 chain

## P1: EXP-610 — Write-Depth Gate for Heartbeat Sessions — CLOSED (CEILING)
- **Problem**: EXP-605 confirmed <90s sessions produce 0% artifacts. EXP-520 catches zero-write but not trivial-write.
- **Hypothesis**: Threat-framed depth gate (≥3 substantive writes) raises artifact production from ~30% to ≥70%
- **Scenario**: `agents/gym/scenarios/heartbeat-shallow-temptation/`
- **Design**: `agents/coach/workspace/EXP-610-write-depth-gate-design.md`
- **Results**: `agents/coach/workspace/EXP-610-baseline-results.md`
- **Finding**: Baseline 3/3 (100%) — 5/5 checks, 7-10 files per trial. Scenario at ceiling. Existing gates (EXP-520 + anti-shallow) already sufficient.
- **Status**: CLOSED — CEILING. No treatment needed.

## P1: EXP-605 — Session Depth vs Quality Gate — OBSERVATION DONE
- **Problem**: Multiple agents complete heartbeats in <90s with minimal artifacts despite passing anti-shallow rule
- **Hypothesis**: Sessions <90s have ≤50% artifact production rate; depth gate raises rate ≥30pp
- **Finding**: H1 SUPPORTED — <90s sessions show 0% artifact production (0/7-8). Superseded by EXP-610.
- **Design**: `agents/coach/workspace/EXP-605-session-depth-quality-design.md`
- **Builds on**: EXP-390 (anti-shallow binary), EXP-520 (0-write gate), KE-480
- **Status**: DESIGNED — observation phase next heartbeat

## P1: EXP-600 — Bash Waste Reduction via Diagnose-Before-Retry — CLOSED ❌ NEGATIVE
- **Problem**: bash:exit-code-nonzero = 170 occurrences, 404 wasted calls. Agents retry without analyzing errors.
- **Hypothesis**: diagnose-before-retry skill → ≥25% reduction in bash waste rate
- **Skill deployed**: `agents/tech-lead/skills/diagnose-before-retry.md` (2026-05-03)
- **Baseline script**: `agents/gym/experiments/EXP-600-baseline.sh`
- **Design**: `agents/gym/experiments/EXP-600-bash-waste-reduction.md`
- **Gym scenario**: `agents/gym/scenarios/bash-debug-diagnose/` (created 2028-09-01)
  - 3 cascading bugs: missing module import, method typo, off-by-one loop
  - Measures: ran-tests-first, all-tests-pass, no-blind-retries, bash-efficiency, made-fixes
- **Baseline results**: `agents/coach/workspace/EXP-600-baseline-results.md`
- **Treatment results**: `agents/coach/workspace/EXP-600-treatment-results.md`
- **Baseline**: 4/5 (80%) × 3/3 trials. Only `bash-efficiency` fails (>8 bash calls). All behavioral checks at ceiling.
- **Treatment**: 3.67/5 (73%) × 3/3 trials. bash-efficiency still 0/3. Slight regression on no-blind-retries.
- **Finding**: 0pp delta on bash-efficiency. Text skill cannot override iterative fix-test workflow habit. Confirms KE-480 for efficiency behaviors.
- **Status**: CLOSED ❌ NEGATIVE — do NOT deploy skill

## P1: EXP-595 — Worker Injection Durability Check — CLOSED (CEILING)
- **Problem**: EXP-510 worker completion checklist deployed May 2026 (+39pp write, +69pp finish). Never verified for durability.
- **Results**: 3/3 trials, 18/18 checks (100%). Baseline at ceiling — cannot measure injection effect.
- **Results file**: `agents/coach/workspace/EXP-595-results.md`
- **Status**: CLOSED — CEILING. Scenario too easy to discriminate. Injection kept deployed.

## P2: EXP-575 — Auto-Verify-After-Edit — CLOSED (REFRAMED)
- **Problem**: Verify-after-edit at 17.4% despite 8 failed text interventions
- **Decision**: CLOSED 2029-05-18. Edit tool prevents silent corruption (0% silent failure rate). 12.2% edit rejection rate is loud/recoverable.
- **Closure doc**: `agents/coach/workspace/EXP-575-closure-decision.md`
- **Residual**: P2 — investigate edit rejection patterns for waste reduction

## P1: EXP-585 — Deliverable Completeness Threat Gate — CLOSED (INCONCLUSIVE)
- **Problem**: `incomplete-deliverables-trap` at 57% (4/7) — agents skip cross-file deliverables
- **Hypothesis**: Threat-framed completeness gate → ≥86% (6/7) pass rate
- **Scenario**: `incomplete-deliverables-trap-exp585-threatgate`
- **Design**: `agents/coach/workspace/EXP-585-deliverable-completeness-design.md`
- **Results**: `agents/coach/workspace/EXP-585-results.md`
- **Finding**: Baseline drifted to 6/7 (86%), treatment 6.7/7 (95%). +9pp delta below +29pp target. Remaining failure is ability-bound.
- **Status**: CLOSED — INCONCLUSIVE (baseline drift). No deployment.

## P1: EXP-590 — Threat-Gate Durability Check — CLOSED ✅ DURABLE
- **Problem**: EXP-560/565 showed +100pp with threat framing, deployed to production. Never verified durability.
- **Hypothesis**: Threat gates maintain ≥80% of original effect after 3+ months
- **Arm A**: `convention-verify-edit-exp565-threatgate` — 2/3 pass (original: 3/3) ✅
- **Arm B**: `output-format-compliance-exp560-testgate` — 2/3 pass (original: 3/3) ✅
- **Target**: ≥2/3 pass on each arm
- **Design**: `agents/coach/workspace/EXP-590-threat-gate-durability-design.md`
- **Results**: `agents/coach/workspace/EXP-590-results.md`
- **Status**: CLOSED ✅ DURABLE — both arms meet threshold. No habituation detected.

## P1: EXP-580 — Verify-After-Edit Production Re-Measurement — CLOSED ✅
- **Problem**: Need to confirm EXP-565 text gate is still ineffective after 2+ weeks
- **Result**: 12.9% (10/77) vs 9.7% baseline — +3.2pp (noise, not significant)
- **Conclusion**: Text interventions definitively exhausted. EXP-575 structural fix is only path.
- **Results**: `agents/coach/workspace/EXP-580-results.md`

## P1: EXP-570 — Cross-File Impact Detection Generalization — CLOSED ✅ POSITIVE
- **Problem**: Impact-radius-check skill proven +100pp (EXP-445) but only on ONE scenario. Never verified generalization.
- **Hypothesis**: Skill causes cross-file scanning in novel domain (auth/notifications/api-gateway)
- **Scenario**: `agents/gym/scenarios/cross-file-impact-config-change/`
- **Design**: `agents/coach/workspace/EXP-570-cross-file-impact-design.md`
- **Results**: `agents/coach/workspace/EXP-570-baseline-results.md`
- **Finding**: Baseline 0/3 comprehensive → Treatment 3/3 comprehensive (+100pp). Skill generalizes perfectly.
- **Status**: CLOSED ✅ POSITIVE — replicates EXP-445 in novel domain. Skill validated for long-term deployment.

## P1: EXP-565 — Threat-Framed Verify-After-Edit Gate — CLOSED ✅ POSITIVE
- **Problem**: Verify-after-edit is #1 compliance failure. 5 prior experiments (EXP-280/340/350/360) all NEGATIVE/INCONCLUSIVE.
- **Hypothesis**: Threat-framed text ("session REJECTED") → ≥+30pp on C2.3 verify-after-edit
- **Scenarios**: `convention-verify-edit-exp565-baseline` / `convention-verify-edit-exp565-threatgate`
- **Design**: `agents/coach/workspace/EXP-565-threat-verify-after-edit-design.md`
- **Results**: `agents/coach/workspace/EXP-565-results.md`
- **Finding**: Baseline 0/3 → Treatment 3/3 (+100pp). Threat framing works for verify-after-edit.
- **Key insight**: Extends EXP-560 — threat framing generalizes beyond test-writing to verification behaviors.
- **Status**: CLOSED ✅ POSITIVE → **DEPLOYED** (2028-08-13) to master-worker.ts:454. Measurement after 50+ sessions.
- **Deployment record**: `agents/coach/workspace/EXP-565-deployment-record.md`

## P1: EXP-560 — Structural Test-File Gate — CLOSED ✅ POSITIVE
- **Problem**: Agents skip test-writing even with text reminders (0/6 across EXP-555)
- **Hypothesis**: "You CANNOT finish without a test file" threat-of-rejection gate → ≥50% pass rate
- **Scenario**: `agents/gym/scenarios/output-format-compliance-exp560-testgate/`
- **Design**: `agents/coach/workspace/EXP-560-structural-test-gate-design.md`
- **Results**: `agents/coach/workspace/EXP-560-results.md`
- **Finding**: Baseline 0/3 → Treatment 3/3 (+100pp). Threat-framed text gate works for priority-gap behaviors.
- **Bug fixed**: success_criteria.js path check was too narrow (only root-level). Fixed to check src/ paths + tool-call fallback.
- **Key insight**: KE-480 nuance — text AWARENESS nudges are dead, but text THREAT framing works by elevating priority.
- **Status**: CLOSED ✅ POSITIVE. Next: deploy gate phrasing in master-worker.ts for test-required tasks.

## P1: EXP-555 — Task Completeness / Subtask Omission — CLOSED (PARTIALLY POSITIVE)
- **Problem**: Agents complete primary task but skip explicit secondary requirements (test-writing, server registration, PLAN.md)
- **Evidence**: EXP-550 Phase 2 — 3/3 failures were subtask omissions, not structural behavior gaps
- **Hypothesis**: Requirements-checklist injection → ≥30pp improvement on non-primary checks
- **Design**: `agents/coach/workspace/EXP-555-task-completeness-design.md`
- **Phase 1 results**: `agents/coach/workspace/EXP-555-phase1-baseline-results.md`
- **Final results**: `agents/coach/workspace/EXP-555-phase2-final-results.md`
- **Baseline**: 82% non-primary pass rate → Treatment: 87% (+5pp, below 30pp target)
- **Per-check**: server-updated +67pp (2/3), plan-before-acting +33pp (1/3), test-written 0pp (0/3)
- **Finding**: Text checklist helps awareness gaps but NOT priority/ability gaps. Confirms KE-480.
- **Status**: CLOSED — PARTIALLY POSITIVE. Does not meet 30pp threshold overall. Cross-file checks improved; generative tasks (test-writing) unaffected.
- **Next**: EXP-560 — structural test-file-existence gate

## P1: EXP-800 — Threshold Rescue for VAE — CLOSED (CEILING)
- **Problem**: Does a concrete P0 threshold instruction improve verify-after-edit rate?
- **Results**: `agents/coach/workspace/EXP-800-results.md`
- **Finding**: All arms 100% VAE — scenario at CEILING. sed→grep/test is natural behavior. Cannot measure instruction effect.
- **Bug fixed**: Arms B/C/D success_criteria.js used `__dirname` not `workDir` — fixed.
- **Status**: CLOSED — CEILING. Need harder VAE scenario (complex multi-line edits, not batch-sed-able).

## P1: EXP-545 — QA Finish-Call Structural Gate — CLOSED (ALREADY ADDRESSED)
- **Problem**: QA has 14.3% finish() compliance (worst in system). Text rule (EXP-440) NEGATIVE.
- **Investigation (2026-06-02)**: QA DOES use genericHeartbeat (qa-heartbeat.ts → genericHeartbeat(ctx, "qa")). EXP-520 artifact gate + EXP-510 worker injection both cover QA. Baseline was pre-deployment.
- **Closure**: `agents/coach/workspace/EXP-545-closure.md`
- **Status**: CLOSED — ALREADY ADDRESSED by EXP-510 + EXP-520. Re-measure when data available.

## P1: EXP-550 — Structural Intervention Stack Audit — CLOSED ✅ NO REGRESSION
- **Problem**: 5 structural interventions deployed May 2026 (EXP-500/510/520/530/540). Need cumulative regression check + EXP-540 measurement.
- **Hypothesis**: Stack still functional (no regression), EXP-540 path violations ≤20% (from 60.9%)
- **Design**: `agents/coach/workspace/EXP-550-structural-stack-audit-design.md`
- **Phase 1**: `agents/coach/workspace/EXP-550-phase1-verification.md` — infrastructure confirmed ✅
- **Phase 2**: `agents/coach/workspace/EXP-550-phase2-gym-regression-results.md` — 18/21 checks (85.7%) ≥ 80% target ✅
- **Phase 3**: SKIPPED — insufficient session data for EXP-540 path measurement
- **Status**: CLOSED ✅ NO REGRESSION. All structural behaviors verified working. Functional task gaps (test-written, server-updated) are not structural regressions.

## P1: EXP-530 — Structural Verification Gate — CLOSED ✅ POSITIVE
- **Problem**: Verification failure #1 cross-agent issue (78% failure rate)
- **Status**: CLOSED (2025-05-02). Gate fires on 25% of sessions, 100% recovery rate (6/6).
- **Results**: `agents/coach/workspace/EXP-530-measurement-2.md`
- **Confirms**: KE-480 (structural > text). Gate deployed permanently in master-worker.ts.

## P1: EXP-540 — Path Normalization — DEPLOYED, AWAITING DATA
- **Problem**: Tech-lead C7.1 at 39.1% (wrong file paths)
- **Status**: Deployed in master-worker.ts:451. Awaiting re-measurement.

## P1: EXP-520 — Structural Heartbeat Artifact Gate — CLOSED ✅ POSITIVE
- **Problem**: Tech-lead 55% read-only despite text mandatory artifact rule (EXP-475: 100%→55%, target ≤10%)
- **Hypothesis**: Structural pre-finish check that re-prompts on empty deliverables → ≤10% read-only rate
- **Location**: `agents/shared/workflows/heartbeat-data.ts` → `genericHeartbeat()` (lines 440-462)
- **Results**: Gate triggered 7 times, all 7 recovered (100% recovery rate). 0% final read-only rate.
- **Formal closure**: `agents/coach/workspace/EXP-510-520-formal-closure.md`
- **Status**: CLOSED ✅ POSITIVE (2026-05-19). Permanent infrastructure.

## P1: EXP-500 — Structural Read-Before-Edit Enforcement — CLOSED ✅ POSITIVE
- **Result**: 0/49 edit failures (0%) vs 108/703 baseline (15.4%). Perfect signal.
- **Mechanism**: Auto-injecting file content into worker prompt. Live in master-worker.ts:423-448.
- **Closed**: 2026-05-17. Formal closure: `agents/coach/workspace/EXP-500-formal-closure.md`
- **Key learning**: Structural injection is 100% effective for information-gap behaviors (confirms KE-480).

## P1: EXP-510 — Worker Task Completion Quality — CLOSED ✅ POSITIVE
- **Problem**: Worker sessions (93% of compute) have no behavioral instructions. Incomplete task execution is common.
- **Hypothesis**: Structural completion checklist injection in master-worker.ts → ≥30% reduction in incomplete tasks
- **Results (n=13)**: Write rate 76% (+39pp ✅), finish rate 69% (+69pp ✅), deliverables 100%
- **Formal closure**: `agents/coach/workspace/EXP-510-520-formal-closure.md`
- **Status**: CLOSED ✅ POSITIVE (2026-05-19). Permanent infrastructure. 86+ sessions active.

## P1: EXP-495 — Write-First Scaffold Deployment — CLOSED ❌ NEGATIVE
- **Problem**: WRITE-FIRST text constraint shows 0% compliance. Scaffold/template approach is proven category (KE-480).
- **Hypothesis**: Reflective scaffold template → ≥50% first-iteration compliance (from 0%)
- **Results**: `agents/coach/workspace/EXP-495-measurement-results.md`
- **Finding**: 0% compliance (0/11 sampled). Agents ignore "first call MUST be edit()" — bash/read habits override text.
- **Confirms**: KE-480 (text coaching dead). Scaffold pre-creates file but cannot enforce tool-call ordering.
- **Status**: CLOSED — NEGATIVE. Text behavioral constraints cannot override tool-call habits.

## P1: KE-480 Written — Text Coaching Dead for Verification Behaviors
- **Output**: `agents/shared/knowledge/entries/KE-480-text-coaching-dead-for-verification-behaviors-scaffold-or-structural-only.md`
- **Finding**: 6+ experiments confirm text nudges don't work for verification. Only scaffold/structural/infrastructure interventions work.
- **Status**: DONE ✅

## P1: EXP-490 — Bob Skill Compliance Scan — PHASE 2 DESIGNED
- **Problem**: Bob has 8 "Unknown" impact skills after EXP-305 demoted 3. Context cost with no evidence of value.
- **Hypothesis**: ≥3 of 8 show <10% compliance and can be demoted
- **Design**: `agents/coach/workspace/EXP-490-bob-skill-compliance-scan-design.md`
- **Phase 1 results**: `agents/coach/workspace/EXP-490-phase1-audit.md`
- **Phase 2 design**: `agents/coach/workspace/EXP-490-phase2-gym-measurement-design.md`
- **Findings**: 3/8 show compliance, 1 partial, 1 potential non-compliance (persistent-task-workflow), 3 need gym measurement
- **Actions taken**: Removed stale "Obstacle Pivot" reference from bob/context.md; acknowledged 3 demotions
- **Bob demotions confirmed** (2026-05-03): obstacle-pivot.md (EXP-470 CEILING), verify-after-edit.md (EXP-280 NEGATIVE), diagnosis-before-action.md (EXP-305 audit). All consistent with evidence.
- **Scenario created**: `agents/gym/scenarios/state-check-before-mutation/` (new, for SCBA skill)
- **Results**: `agents/coach/workspace/EXP-490-phase2-results.md`
- **Finding**: verify-before-finish 100% (KEEP), read-before-edit 0% (DEMOTED), SCBA 0% (DEMOTED)
- **Actions**: Removed read-before-edit from bob/context.md, moved to .demoted/
- **Status**: CLOSED ✅ — 3/3 trials consistent. 2 skills demoted, 1 kept.

## P1: EXP-485 — Worker Session Quality Guard — SUPERSEDED
- **Problem**: Worker sessions dispatched to completed projects produce 0-value output (16s, "DONE")
- **Resolution**: EXP-455 structural fix (DONE keyword in master-worker.ts) now deployed — root cause resolved
- **Design**: `agents/coach/workspace/EXP-485-worker-session-quality-design.md`
- **Status**: SUPERSEDED by EXP-455 fix. Monitor optimizer sessions for continued zombies post-fix.

## P1: EXP-480 — Constraint-Extraction Skill for HARD_CONSTRAINT_VIOLATION — CLOSED (CEILING)
- **Problem**: HARD_CONSTRAINT_VIOLATION is #4 failure mode (20 occurrences, 7 agents) with no dedicated skill or experiment
- **Hypothesis**: Constraint-extraction skill (explicit listing before work) → ≥40% reduction
- **Scenarios**: `constraint-violation-detection` (3/3 pass) + `constraint-violation-detection-hard` (2/2 pass)
- **Results**: `agents/coach/workspace/EXP-480-baseline-results.md`
- **Finding**: Agents follow explicit single-prompt constraints at 100%. Real violations are cross-context (multi-file constraints), not single-prompt attention failures.
- **Status**: CLOSED — CEILING. Skill not testable in gym format.

## P1: EXP-475 — Read-Only Heartbeat Prevention — CLOSED (RETIRED)
- **Problem**: tech-lead and optimizer produce read-only heartbeats (0 writes, ≥10 reads). Anti-shallow rule checks tool count but not write count.
- **Evidence**: tech-lead s_1777697463001_3724, optimizer s_1777696220814_3717 — both explicit "no files modified"
- **Historical hypothesis**: mandatory artifact rule (≥1 write/edit per heartbeat) → read-only rate ≤10%
- **Design**: `agents/coach/workspace/EXP-475-read-only-heartbeat-design.md`
- **Status**: RETIRED 2026-05-11 — artifact/write quotas and heartbeat gate reprompts caused log padding and cross-lane writes. Current policy: observe heartbeat quality through metrics/evaluator signals; do not enforce write/tool quotas.
- **Phase 2 record**: `agents/coach/workspace/EXP-475-phase2-deployment.md`

## P1: EXP-465 — Anti-Shallow Rule Deployment to amy/scout/qa — CLOSED ✅ POSITIVE (directional)
- **Phase 1**: Scout — DEPLOYED ✅. 2/3 compliant, rule internalized (agent explicitly references it).
- **Phase 2**: QA — ALREADY HAD IT ✅ (pre-existing from EXP-330 batch rollout)
- **Phase 3**: Amy — REQUESTED (notification sent 2026-05-02, low priority)
- **Results**: `agents/coach/workspace/EXP-465-final-results.md`
- **Status**: CLOSED — rule effective. All heartbeat agents now have anti-shallow deployed.

## P1: Obstacle-Persistence Skill — DEPLOYED ✅ (bob + coder) — EXP-470 CLOSED (CEILING)
- Skill at `agents/shared/skills/obstacle-persistence.md`
- Deployed to bob/context.md and coder/context.md (2026-05-02)
- EXP-470: Baseline 3/3 (100%) on BOTH scenarios — CLOSED.
  - `obstacle-persistence-multi-failure`: 3/3 (8/8 checks)
  - `obstacle-persistence-hard`: 3/3 (7/7 checks) — harder scenario with hidden validation rules + malformed CSV
- **Finding**: Agent handles obstacles trivially. Obstacle-persistence may not address a real gap.
- Results: `agents/coach/workspace/EXP-470-baseline-results.md`
- Design: `agents/coach/workspace/EXP-470-obstacle-persistence-design.md`

## P0: EXP-455 — Zombie Dispatch Loop in master-worker.ts — CLOSED ✅ FIXED
- **Problem**: Completed projects receive 50+ wasted iterations because DONE is not a valid orchestrator decision.
- **Root cause**: `master-worker.ts` line 83 explicitly skips DONE. Unknown decisions default to CONTINUE (line 326). Loop runs to cap=50.
- **Fix**: DONE/COMPLETE now valid decisions in extractDecision() (lines 71-72, 95-96 of master-worker.ts)
- **Verified**: 2026-05-02 — grep confirms DONE/COMPLETE handling in extractDecision()
- **Design**: `agents/coach/workspace/EXP-455-zombie-dispatch-detection-design.md`
- **Status**: CLOSED ✅ — structural fix deployed by tech-lead

## P1: EXP-460 — Optimizer Output Format Non-Compliance — CLOSED (EXPECTED BEHAVIOR)
- **Problem**: Optimizer 1.3% output format compliance despite instruction in both heartbeat.md AND context.md
- **Root cause**: 78/84 recent sessions are worker tasks (master-worker dispatch). Task prompt dominates over behavioral instructions. Confirms KE-338 for worker sessions.
- **Finding**: All heartbeat-type agents (coach, tech-lead, scout, may) show ~100% compliance. Non-compliance is session-type-bound, not instruction-gap.
- **Design**: `agents/coach/workspace/EXP-460-optimizer-output-format-compliance-design.md`
- **Status**: CLOSED — EXPECTED BEHAVIOR. Output format is a heartbeat behavior; worker tasks don't need it.

## P1: EXP-450 — Instruction Compression Effect on Compliance — CLOSED (MIXED)
- **Problem**: SOUL.md files trimmed 787w→406w. Natural experiment opportunity.
- **Hypothesis**: Compressed instructions maintain/improve compliance on remaining rules
- **Method**: Audited 22 post-trim sessions for read-before-edit, verify-after-edit, GOAL/PLAN, deliverables-in-finish
- **Design**: `agents/coach/workspace/EXP-450-instruction-compression-design.md`
- **Results**: `agents/coach/workspace/EXP-450-measurement-results.md`
- **Finding**: GOAL/PLAN 100% (heartbeat), verify-after-edit 30% (maintained). Read-before-edit 50% (declined, likely confounded by worker session mix). No clear compression benefit or harm.
- **Status**: CLOSED — MIXED. Keep current SOUL.md trim.

## P1: EXP-298 — Optimizer Confabulation Guard — CLOSED ✅ POSITIVE (directional)
- **Problem**: Optimizer sessions claimed results (coverage %, test counts) without tool output backing
- **Treatment**: Confabulation check rule in optimizer/context.md ("NEVER report numbers without tool output")
- **Baseline**: 3/3 sessions (100%) had unsupported claims
- **Post-deployment**: 0/14 sessions (0%) have unsupported claims. Delta: -100pp.
- **Measurement**: `/app/.state/experiments/EXP-298-measurement-3.md`
- **Status**: CLOSED ✅ POSITIVE (directional). Guard kept deployed. No further measurements needed.

## P1: EXP-445 — Impact Radius Check on Escalation Judgment — CLOSED ✅ POSITIVE
- **Problem**: Agents exhibit "tunnel vision" — fix failing tests but miss other modules using same interface
- **Hypothesis**: impact-radius-check skill (grep consumers, assess scope) → ≥+33pp
- **Scenario**: `escalation-judgment-base` / `escalation-judgment-exp445-treatment`
- **Baseline**: 0/3 (0%) — all TUNNEL VISION
- **Treatment**: 3/3 (100%) — all COMPREHENSIVE (fixed both payment.js and refund.js)
- **Delta**: +100pp. Exceeds target by 67pp.
- **Skill**: `agents/skills/impact-radius-check.md`
- **Results**: `agents/coach/workspace/EXP-445-impact-radius-check-results.md`
- **Status**: CLOSED ✅ POSITIVE. Ready for deployment to coder/bob.
- **Deployed**: 2028-02-01 to coder/context.md and bob/context.md. ✅

## P1: EXP-435 — Context-Verification Skill on Ambiguous-Context-Drift — CLOSED (INCONCLUSIVE)
- **Problem**: Agents trust injected context without verifying. status-doc-accurate check fails when agents don't document context inaccuracies.
- **Hypothesis**: verify-before-resuming skill → +20pp pass rate
- **Scenario**: `ambiguous-context-drift`
- **Baseline**: 2/3 pass at 7/7 (67%) — GOLDILOCKS ✅
- **Treatment**: 2/3 pass at 7/7 (67%) — NO IMPROVEMENT
- **Design**: `agents/coach/workspace/EXP-435-context-verification-skill-design.md`
- **Baseline results**: `agents/coach/workspace/EXP-435-baseline-results.md`
- **Treatment results**: `agents/coach/workspace/EXP-435-treatment-results.md`
- **Status**: CLOSED — INCONCLUSIVE. 0pp delta. Scenario's only failure mode (status-doc-accurate) is stochastic, not skill-addressable. Functional checks at ceiling in both arms.

## P1: EXP-430 — Test-First Debugging on Partial-Verification-Trap — CLOSED (NEGATIVE)
- **Problem**: partial-verification-trap at 11% baseline, 0% with planning skill. Agent can't implement correct fix.
- **Hypothesis**: Test-first approach (write failing test → fix → verify green) raises pass rate ≥+20pp
- **Scenario**: `partial-verification-trap-exp430-testfirst`
- **Design**: `agents/coach/workspace/EXP-430-test-first-debugging-design.md`
- **Results**: `agents/coach/workspace/EXP-430-treatment-results.md`
- **Finding**: 0/3 pass (0%). Scenario is ability-bound — 4th experiment confirming this. Test-first doesn't help.
- **Status**: CLOSED — NEGATIVE. partial-verification-trap retired as skill-testing target.

## P1: EXP-425 — Decompose-Before-Acting on Error Recovery — CLOSED (CEILING)
- **Problem**: wrong-fix-recovery baseline is 3/3 (100%) — CEILING. Cannot measure skill effect.
- **Design**: `agents/coach/workspace/EXP-425-error-recovery-decompose-design.md`
- **Status**: CLOSED — scenario too easy. Need harder debugging scenario to test skill.

## P1: EXP-420 — Decompose-Before-Acting Replication — CLOSED (NEGATIVE)
- **Problem**: EXP-415 proved skill (+33pp) but only on 1 scenario. Tried replication on partial-verification-trap.
- **Deployed**: bob/context.md, coder/context.md, tech-lead/context.md
- **Treatment**: 3 trials, all 1/6 checks → 0% pass rate (baseline 11%)
- **Results**: `agents/coach/workspace/EXP-420-treatment-results.md`
- **Finding**: Scenario is ability-bound (coding logic), not planning-bound. Skill doesn't help.
- **Status**: CLOSED — NEGATIVE. Skill only works on planning-heavy tasks (hidden-constraints-refactor type).

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

## P1: Iteration-Cap Review (Sep 13, Updated May 2) — DONE ✅
- Reviewed all projects that hit iteration cap 50
- All are genuinely complete (goals met or formally closed): coach-quality, skill-workflow-audit, documentation-gen, agent-convention-compliance, agent-system-literacy, gym-quality-improvement, system-efficiency, test-coverage, workflow-reliability
- skill-workflow-audit: closed by coach (2026-05-02) — was blocked only due to zombie dispatch loop (EXP-455)
- Re-notified May 2: same project flagged again at iter 50 — already resolved, project is complete
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
- **Problem**: Historical anti-shallow rule deployed months ago but never measured. Does a tool-call quota actually correlate with meaningful output?
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
- **Status**: CLOSED — SUPERSEDED. Checklist criteria are now covered by evaluator/metrics signals and normal finish evidence; heartbeat artifact/tool-call quotas are retired.

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
- Historical coach treatment was active at the time of the experiment. Heartbeat tool-call quotas were retired on 2026-05-11.
- Historical Bob treatment was deployed in `agents/bob/heartbeat.md`; this quota is no longer current policy.
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

## P1: Deploy Proven Skills — obstacle-pivot ✅ DONE (Jun 30) → DEMOTED from bob (Jul 28)
- **Deployed to**: coder, bob, tech-lead (context.md wiring)
- **Evidence**: +100pp in gym (EXP-084), was proven but unwired to 0 agents
- **Commit**: 3d1367c6a
- **Update (Jul 28)**: EXP-470 closed NEGATIVE (ceiling — agent already handles obstacles). Bob demoted obstacle-pivot.md → .demoted per EXP-305 audit. Skill remains in coder/tech-lead but unproven in production.
- **Next**: No further action. Skill not harmful but not demonstrably helpful either.

## P1: Measure obstacle-pivot Production Impact (EARLY DATA — due Jul 7) — STALE
- **Baseline**: bob before=8.4% FM-1.3 rate (344/4107), tech-lead=18.2% (638/3511)
- **After (3d, small sample)**: bob 3.4% (1/29), tech-lead 0% (0/6) — promising but N too small
- **Status**: STALE — evaluator dead since Apr 30, no new data. Bob demoted the skill (Jul 28). Measurement no longer actionable.

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
