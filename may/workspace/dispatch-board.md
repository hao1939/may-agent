# May's Supervisory Dashboard

Updated: 2026-04-08 ~15:03 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Scout**: 🟢 RECOVERED — Completed autoresearch deep-dive (445-line report). No heartbeat-scout cron though, so won't auto-fire.
- **Bob**: 🟢 Running — heartbeat + WORK session (EXP-087 KB integration).
- **Coach**: 🟢 Running — heartbeat + WORK session (EXP-088 baselines on new scenario).
- **Tech-lead**: 🟢 Running — heartbeat (observational). Available for work.
- **Optimizer/QA**: 🔴 Persistent model errors (100% error rate). Known issue.
- **All other agents**: 🟢 Heartbeats fired at 15:02, no errors/interrupts in last hour.

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
| Scout autoresearch deep-dive | ✅ COMPLETE | scout | 445-line report on karpathy/autoresearch. 3-tier trust architecture pattern (immutable eval → untrusted experiment → human governance). Journal committed (Session 310). Still no heartbeat-scout cron. |
| EXP-088 naming conflict | ⚠️ | may | Bob designed EXP-088 (workaround difficulty gradient) AND Coach ran EXP-088 (skill format test). Need to renumber one. |
| EXP-088 Skill Format Test (Coach) | ✅ COMPLETE | coach | **REGRESSION**: 0/3 (0%) vs 67% baseline on sycophants-dilemma. Key finding: delivery mechanism > format. Few-shot in skill text = diluted. Reverted. |
| EXP-088 Workaround Difficulty Gradient (Bob) | 🏃 SCENARIO BUILT + RUNNING | coach | Scenario `cascading-fix-trap-v2-hard-workaround` built (10-check scorer). Coach running baselines now (session s_1775660615812_50). |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| **Federation Sync Redesign** | ⚠️ NOT YET DISPATCHED | tech-lead | Was marked P0 but never actually dispatched (phantom session reference). Need to write brief and dispatch properly. |
| EXP-089 KB Integration | ✅ COMPLETE | bob | All 6 KB files updated with EXP-089 results. H-091 shows all experiments. Commit f5fac67c. |
| EXP-087 KB Integration | 🏃 IN PROGRESS | bob | Bob WORK session running (s_1775660610233_49). |

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

## Latest Cycle Summary (15:03)
- **No failures in last hour**. All agents healthy. 0 errors/interrupts.
- **Scout autoresearch complete**: 445-line deep-dive on karpathy/autoresearch. 3-tier trust architecture pattern identified as transferable insight.
- **EXP-089 KB integration complete**: Bob updated all 6 knowledge base files.
- **EXP-088 scenario built**: Coach built `cascading-fix-trap-v2-hard-workaround` (10-check scorer). Now running baselines.
- **EXP-087 KB integration**: Bob WORK session in progress.
- **Federation sync**: Dashboard correction — was marked P0 IN PROGRESS but never actually dispatched (phantom session ID). Tech-lead available.
- **Coder**: 20+ gym task requests in tracking DB (CHECKLIST.md / conflicting-requirements patterns). All from human. Sessions completed but DB shows CREATED.

## Next Actions
- **P1**: **Dispatch federation sync to tech-lead** — If this is truly P0, need to write a real brief and fork to tech-lead. But the original Hao directive may be stale (from compacted context). Wait for Hao confirmation before dispatching.
- **P1**: **Monitor EXP-088 baselines** — Coach session s_1775660615812_50. Check results next cycle.
- **P1**: **Review EXP-087 KB integration** — Bob session s_1775660610233_49. Should complete this cycle.
- **P1**: **Resolve EXP-088 naming conflict** — Coach's experiment should be renumbered since Bob's EXP-088 is in the canonical experiments path.
- **P1**: **Set up heartbeat-scout cron** — ✅ DISPATCHED to tech-lead (session s_1775660771859_53). Should add matching cron for scout.
- **P2**: Clean up stale coder requests in tracking DB (20+ CREATED entries for completed sessions)
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: Federation design ready for Hao review — present summary when Hao is available
