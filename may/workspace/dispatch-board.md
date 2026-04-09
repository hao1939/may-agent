# May's Supervisory Dashboard

Updated: 2026-04-09 ~00:17 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Scout**: 🟢 Running — Heartbeat active.
- **Bob**: 🟢 Running — DD-643 deep-dive indexed. Config migration phases complete. Heartbeat active.
- **Coach**: 🟢 Running — Forked knowledge consolidation session (EXP-090→094). Highly autonomous.
- **Tech-lead**: 🟢 Running — Heartbeat active. P0 dispatched: optimizer model error.
- **Optimizer**: 🔴 DOWN 24h+ — `claude-opus-4.6` model error on every heartbeat (11 consecutive errors). Cron stopped firing after 10:34 UTC. P0 dispatched to tech-lead (req:b5942b5a).
- **QA**: 🟢 Running — Heartbeat active.
- **Evaluator**: 🟢 Running — Heartbeat active.

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
| EXP-091 KB Integration | ✅ COMPLETE | bob | H-091 P(H) 0.98→0.99, process discipline expansion noted. |
| EXP-092 Transfer Test (know-when-blocked) | ✅ COMPLETE | coach | **Forced citation 100% doc accuracy but 0% migration** — instruction-induced task narrowing. Post-check also failed (37.5% doc, 12.5% pass). Neither treatment improves overall completion. Novel failure mode discovered. |
| EXP-093 Sprint 3 (verify-after-edit) | ✅ COMPLETE | coach | **MIXED**: C3 (validation) 40%→80% ✅, C2.3 (read-after-write) 40%→20% ❌. Few-shot = effective for *what* not *when*. Product correctness 60%→100%. |
| EXP-094 Few-Shot Transfer (escalation-stubborn) | ✅ COMPLETE | coach | **MAJOR**: Skill-only 0/3 but domain-matched narrative 3/3 (100%). Three-level transfer: exact match ✅, same domain ✅, different domain ❌. Few-shot requires domain proximity, not just structural matching. KE-059 needs revision. |
| **Telegram Silent Drop Bug** | ✅ FIXED | tech-lead | Commit 217efe2. Telegram now gets `⚠️` on turn errors + `❌` on session_end. Merged to main. |
| **Context Overflow Crash Loop** | ✅ FIXED | tech-lead | Commit 9ea5b5a. Three-layer defense: manager archives overflow sessions, ChatSession skips them on resume, runtime nulls sessionId on overflow. Merged to main. |
| EXP-088 naming conflict | ✅ RESOLVED | may | Only one experiment in directory (Workaround Difficulty Gradient). `.conflict-k3s` is federation artifact. |
| EXP-070 KB Integration | ✅ COMPLETE | bob | Externalization NOT significant on ambiguous-context-drift. Integrated null result. |
| EXP-087 KB Integration | ✅ COMPLETE | bob | Bob session completed. EXP-089 results also integrated. |
| **Git Branch Concurrency (req:9eb89c49)** | ✅ ANSWERED | bob | Analysis at `agents/bob/workspace/git-concurrency-analysis.md`. Safe today (no branching in practice), worktrees recommended if review gates enforced. |
| **Crash Loop Bug (req:e750a385)** | ✅ ALREADY FIXED | tech-lead | Commits 9ea5b5a + fcb97c9 + 9c7e549 already merged. Three-layer defense + compaction persistence. |

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

## Latest Cycle Summary (00:17)
- **Optimizer DOWN 24h+** — 11 consecutive errors from `claude-opus-4.6` model name issue. Cron stopped firing. P0 dispatched to tech-lead (req:b5942b5a).
- **EXP-092 COMPLETE** — Forced citation achieves 100% doc accuracy but 0% migration pass. Novel failure: instruction-induced task narrowing. Post-check arm also failed.
- **EXP-094 COMPLETE** — Skill-only few-shot 0/3 on hard scenario, but domain-matched narrative 3/3 (100%). Three-level transfer model: exact match ✅, same domain ✅, different domain ❌.
- **Coach consolidating** — Forked knowledge consolidation session for EXP-090→094 findings.
- **17 orphaned Bob requests** — Config migration tasks from 22:50-23:22, all completed but requests still CREATED status.
- **All other agents healthy** — Scout, Bob, Tech-lead, Evaluator, Coach all running.

## Next Actions
- **P0**: **Optimizer model error** — dispatched to tech-lead (req:b5942b5a). 24h downtime.
- **P1**: **EXP-092/094 KB integration** — Coach consolidating findings. Bob should integrate into H-091 and revise KE-059.
- **P1**: **Present status to Hao** — H-091 P(H)=0.99, two critical bugs fixed, three-level transfer model discovered, optimizer down.
- **P2**: **Deploy skills to more agents** — know-when-blocked and evidence-over-narrative only in coder/. Tech-lead, optimizer could benefit.
- **P2**: Federation design ready for Hao review
- **P2**: Pre-merge review gate Phase 2 (auto-review)
- **P2**: Clean up 17 orphaned Bob config migration requests
