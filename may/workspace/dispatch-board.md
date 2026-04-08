# May's Supervisory Dashboard

Updated: 2026-04-08 ~23:20 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Bob**: 🟢 Running — Heartbeat cycle active. Processing EXP-092 data.
- **Coach**: 🟢 Running — EXP-092 Arm B fork in progress (runs 06-08 done, 09 running). Arm B: 3/8 pass so far.
- **Tech-lead**: 🟢 Completed — C2.3 v4 brief reviewed. BLOCKED on Hao for binary rebuild. finish-guard.ts complete (56 tests pass).
- **Scout**: 🟢 Running — Fresh heartbeat cycle.
- **Optimizer/QA/Evaluator**: 🟢 Running — Heartbeats firing.
- **All agents**: 🟢 All 7 heartbeats firing (Amy-kimi still down).

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production (Hao's directive)
4. Session digest system as unified recovery
5. Design docs before implementation

## What I'm Watching
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| EXP-083 Cross-Reference Generalization | ✅ COMPLETE | coach/bob | **MAJOR**: 100% treatment vs 0% baseline across 2 new domains (env-repair + schema-migration). Cross-reference skill generalizes perfectly. H-089 promoted to Tier 1 (P(H)=0.92). Bob integrated. |
| Federation Design (Local ↔ K3s) | ✅ DESIGN COMPLETE | bob | Bob produced 558-line design doc at `agents/shared/research-projects/federation-design.md`. Recommends Enhanced Git Federation (no new infra). 5-phase migration. Ready for Hao review. |
| EXP-085 Few-Shot Generalization | ✅ COMPLETE | coach | **MAJOR**: 3/3 pass (100%) on escalation-judgment vs 12.5% baseline. Few-shot generalizes across judgment scenarios. H-091 promoted to Tier 1 (P(H)≥0.90). |
| KE-060 Intervention Taxonomy | ✅ COMPLETE | bob | Unified taxonomy: 3 mechanisms (M1: Analysis Activation, M2: Evidence Discovery, M3: Structural Constraint). Diagnostic decision tree. Written and verified. |
| EXP-086 Few-Shot Boundary Test | ✅ COMPLETE | coach | **Mismatched 66.7% vs matched 100% vs baseline 12.5%**. Two-level transfer model: general principle transfers, specific procedure doesn't. H-091 updated. |
| EXP-086 Knowledge Integration | ✅ COMPLETE | bob | H-091 P(H) 0.88→0.90, two-level transfer model integrated, PRIORITY-TRACKER/INDEX updated. |
| EXP-087 Sycophants-Dilemma Few-Shot | ✅ COMPLETE | coach | **3/3 pass (100% vs 67% baseline)**. Matched few-shot closes last non-ceiling scenario. All judgment scenarios now have path to 100%. |
| EXP-087 Knowledge Integration | ✅ COMPLETE | bob | H-091 P(H) 0.90→0.92, matched few-shot 9/9 (100%) across 3 scenarios. Commit 7fc481e2. |
| Cross-Reference Skill Deployment | ✅ COMPLETE | coach | 71-line skill deployed to coder at `coder/skills/cross-reference-before-config-repair.md`. Commit fe91729e. |
| Auto-Loop Analysis | ✅ COMPLETE | tech-lead + bob | **Both converge**: zero engine changes needed. Decision brief written → `agents/may/workspace/auto-loop-decision-brief.md`. Ready for Hao. |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Scout autoresearch deep-dive | ✅ COMPLETE | scout | 445-line report on karpathy/autoresearch. 3-tier trust architecture pattern. Heartbeat-scout cron now active (30min). |
| EXP-088 naming conflict | ⚠️ | may | Bob designed EXP-088 (workaround difficulty gradient) AND Coach ran EXP-088 (skill format test). Need to renumber one. |
| EXP-088 Skill Format Test (Coach) | ✅ COMPLETE | coach | **REGRESSION**: 0/3 (0%) vs 67% baseline on sycophants-dilemma. Key finding: delivery mechanism > format. Few-shot in skill text = diluted. Reverted. |
| EXP-088 Workaround Difficulty Gradient (Bob) | ✅ COMPLETE | coach | **MAJOR**: Baseline 2/3 (67%), Treatment 3/3 (100%) vs v2 0/18 (0%). Difficulty gradient confirmed (H-088). Making correct fix easier > any training intervention. Bob integrating into KB. |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| **Federation Sync Redesign** | ✅ COMPLETE | tech-lead | **P0 from Hao**. Ownership-aware conflict resolution in agents-auto-commit.ts (348→692 lines). Instance config, heartbeat writing, federation dirs. TSC clean. Auto-committed and pushed. Session `s_1775659647453_55`. |
| Few-Shot Conversion Sprint Plan | ✅ COMPLETE | bob | Plan at `agents/bob/workspace/few-shot-conversion-plan.md`. Top 5: know-when-blocked (#1), evidence-over-narrative (#2), investigate-and-fix (#3), obstacle-pivot (#4), read-before-edit (#5). Sprint 1 dispatched to coach. |
| Few-Shot Sprint 1 (EXP-090) | ✅ COMPLETE | coach | **MAJOR**: Both skills 0%→100%. know-when-blocked 0/3→3/3 (5/5 checks). evidence-over-narrative 0/3→3/3 (8/8 checks). H-091 P(H) → 0.98. Results at `agents/shared/knowledge/experiments/EXP-090/results.md`. |
| EXP-090 KB Integration | ✅ COMPLETE | bob | H-091 P(H) 0.92→0.98, matched few-shot 12/12 across 5 scenarios. Commit dc3acd2d. Gym-failure-remediation strategy also updated. |
| EXP-091 Skill Deploy (evidence-over-narrative) | ✅ COMPLETE | coach | Skill deployed to coder with few-shot. Regression checks: hidden-dependency 5/5 ✅, phantom-fix-config 2/5 (matches baseline, no regression). |
| EXP-091 Sprint 2 (investigate-and-fix) | ✅ COMPLETE | coach | **MAJOR**: reproduce-first 0/3→3/3 (100%). Process score 4/5→5/5. **First evidence few-shot works for process discipline, not just judgment.** H-091 P(H) → 0.99. Cumulative 9/9 treatment runs (100%) vs 0/9 control. |
| EXP-070 Extended Baseline | ❌ INTERRUPTED | coach | 99min watchdog timeout. Was debugging gym runner scoring bug (0/0 results from cleanup timing). Needs retry. |
| EXP-070 KB Integration | ✅ COMPLETE | bob | Externalization NOT significant on ambiguous-context-drift. Integrated null result. |
| EXP-092 Design | ✅ DESIGNED | bob | Forced analysis-to-documentation transfer. 2 arms: forced citation + post-check. Addresses EXP-070 transfer gap (10/10 analysis correct but only 6/10 transferred). |
| EXP-092 Gym Trials | ⏳ PARTIAL | coach | **Arm A: 10/10 complete** (status_doc 100%). **Arm B: 8/10 complete** (3/8 status_doc=True, 37.5%). Massive delta: 100% vs 37.5%. Runs 09-10 in progress. |
| EXP-093 Design (Sprint 3) | ✅ COMPLETE | bob | **Pivoted**: Original targets (read-before-edit 91%, verify-before-finish 100%) at ceiling. Redirected to verify-after-edit (0% on convention-verify-edit). 2 gym scenarios created. 16-run 2-arm design. Protocol at `EXP-093/protocol.md`. Delegated to Coach. |
| EXP-093 Gym Trials | ✅ COMPLETE | coach | **Mixed results**: C3 validation +40pp (40%→80%), but C2.3 verify-after-edit -20pp. Few-shot teaches "what" not "when". Product quality +40pp. H-091 P(H) 0.99→0.95. |
| EXP-093 KB Integration | ✅ COMPLETE | bob | All 12 checks pass. H-091/KE-059/KE-060/INDEX/PRIORITY-TRACKER updated with "what vs when" finding. |
| Investigate-and-fix Skill Deploy | ⏳ DISPATCHED | coach | Proven 100% in EXP-091 Sprint 2. Dispatched to coach (req:de472a36). Original req c8bf94e7 completed as part of EXP-092 batch but skill wasn't actually deployed. |
| Bob FM-1.3 Growth Cycle | ❌ INTERRUPTED | coach | Session s_1775679553637_184 interrupted. Needs retry next cycle. |
| C2.3 Auto-Readback v2 Brief | ✅ COMPLETE | bob | Revised after tech-lead feedback. Proposes finish-time verification gate in finish-guard.ts. |
| **C2.3 Finish-Time Gate** | ⚠️ **BLOCKED on Hao** | tech-lead | Library COMPLETE (238 lines, 56 tests). BUT finish() tool handler is inside compiled binary (104MB ELF). Cannot wire finish-guard without Hao rebuilding binary. Assessed as blocked 3 times (v1, v3, v4). |
| EXP-087 KB Integration | ✅ COMPLETE | bob | Bob session completed. EXP-089 results also integrated. |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
| EXP-084 Skill Training Method Comparison | Apr 8 | **MAJOR**: Few-shot breaks the binary! 33% pass, avg 4.3/5 (+2.3). H-091 filed (P(H)=0.75). KE-059 created. Mechanism hierarchy L1→L5 established. |
| EXP-076 Workflow Audit | Apr 8 | Bob forking 5+ WORK sessions/6h (was 0/24h). Workflow adoption validated. |
| Federation Design (Local ↔ K3s) | Apr 8 | Bob produced 558-line design doc. Recommends Enhanced Git Federation, no new infra, 5-phase migration. Ready for Hao review. |
| EXP-083 Cross-Reference Generalization | Apr 8 | **MAJOR**: 100% treatment vs 0% baseline across 2 new domains. Cross-reference skill generalizes perfectly. H-089 → Tier 1 (P(H)=0.92). |
| C1.3 Write-Diff Impact Analysis | Apr 8 | **COMPLETE**: 47.3%→85.1%→94.1% across 3 phases. Write-diff is the single biggest convention compliance intervention. Scout laggard at 76.3%. |
| Knowledge Application Audit | Apr 8 | Bob: 3 major gaps identified (KE-025, KE-029, KE-056) |
| KE-025 Skill Pruning | Apr 8 | Coach: 20→4 files (84%), Evaluator: 13→6 files (33%) — 90KB removed |
| EXP-075 CTA deployment | Apr 8 | Skill deployed (commit 188b98fe), SOUL.md updated |
| EXP-077 Gym fidelity | Apr 8 | L1-L3 scenarios built and tested |
| KE-SUMMARIES 57/57 | Apr 8 | Bob: All knowledge entries now have summaries |
| H-087 P3 retrospective | Apr 8 | Bob: Designed exps 2.05x better (p≈0.013) |
| Code cleanup (all phases) | Apr 8 | Green (-404 lines), medium (+43/-37), architecture review, larger items (lazy→eager + loaded[]) — all merged |
| EXP-082 Knowledge Application Pipeline | Apr 8 | **MAJOR**: P(applies\|pushed) ≈ 0. Agents ignore injected knowledge. KE-058 created. |
| EXP-081 KE-002 Reexamination | Apr 8 | 0/32 total across all categories. KE-002 strengthened: text rules never fix judgment. |
| H-089 Environmental Evidence Discovery | Apr 8 | Bob filed. P(H)=0.70. Absent-info failures via evidence discovery. |
| EXP-080 Growth Cycle (L2 skill) | Apr 8 | +34pp (33%→67%) but not promoted — L2 unreliable. Intervention dosage: L2<L3<L5. |
| EXP-079 Cross-reference breakthrough | Apr 8 | **100% on L3** (+100pp). External evidence > self-reflection. |
| EXP-078 Externalization on L3 | Apr 8 | 0% — diagnosed schema gap → EXP-079 |
| Sprint 31 experiment designs | Apr 8 | Coach: EXP-075/076/077 designed + sprint plan |
| finish() commit guard | Apr 7 | SHIPPED — commit 5babdf8, L5 enforcement |
| KE-053 Competency-Production Gap | Apr 7 | Bob synthesized EXP-065/066 |
| Workflow adoption investigation | Apr 7 | Optimizer: DB metadata was broken (fixed) |
| Research DB tables | Apr 7 | knowledge, hypotheses, experiments tables live |
| Session digest Phases 1-4b | Apr 6 | Shipped and working |
| Anti-busywork campaign | Apr 6 | Bob, Coach, Optimizer heartbeats fixed |
| Agent busywork fix | Apr 6 | All 3 agents fixed — journal refs removed |

## Latest Cycle Summary (23:20)
- **EXP-092: ⏳ NEAR COMPLETE** — Arm A: 10/10 (100% status_doc). Arm B: 8/10 (3/8 = 37.5% status_doc). **MASSIVE 62.5pp delta** — forced citation dramatically improves analysis→documentation transfer. Runs 09-10 in progress.
- **C2.3 Finish-Time Gate: ⚠️ BLOCKED ON HAO** — Library complete (56 tests pass), but finish() handler is inside compiled binary. Cannot wire without Hao rebuild. Assessed blocked 3x now. Stop accepting new briefs.
- **investigate-and-fix skill: ⏳ RE-DISPATCHED** — Original req completed without actual deployment. New req de472a36 sent to Coach.
- **All agents healthy** — All 6 agents (Bob/Scout/Tech-lead/Coach/Optimizer/QA/Evaluator) heartbeats firing. Amy-kimi still down.
- **No errors in last hour** — Clean operations.

## Next Actions
- **P0**: **Present to Hao when available**: C2.3 finish-guard needs binary rebuild (only action remaining). Auto-loop decision brief at `agents/may/workspace/auto-loop-decision-brief.md`. Federation design ready for review.
- **P1**: **EXP-092 Arm B runs 09-10** — Coach in progress. After completion: write results.md and KB integration.
- **P1**: **investigate-and-fix skill deployment** — Coach to deploy to coder/skills/ (req:de472a36).
- **P1**: **Resolve EXP-088 naming conflict** — Coach's EXP-088 (skill format test) vs Bob's EXP-088 (workaround gradient). Need to renumber one.
- **P2**: Bob FM-1.3 growth cycle retry — Dispatched to Coach (P2, after P1s).
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: EXP-070 extended baseline retry — still interrupted from gym runner scoring bug
