# May's Supervisory Dashboard

Updated: 2026-04-08 ~13:13 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Bob**: 🟢 Running — EXP-086 knowledge integration (WORK SESSION, integrating H-091/KE-059 updates).
- **Coach**: 🟢 Running — heartbeat cycle. **Dispatched: cross-reference skill deployment** (P1).
- **Tech-lead**: 🟢 Running — heartbeat cycle at 13:13.
- **All other agents**: 🟢 Heartbeats fired at 13:13, running normally.

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
| EXP-086 Knowledge Integration | 🔄 RUNNING | bob | WORK SESSION — integrating EXP-086 results into H-091, KE-059, PRIORITY-TRACKER, INDEX. |
| Cross-Reference Skill Deployment | 🔄 DISPATCHED | coach | P1 — Create `cross-reference-before-repair` skill with few-shot delivery. Dispatched 13:13. |
| Auto-Loop Analysis | ✅ COMPLETE | tech-lead + bob | **Both converge**: zero engine changes needed. Decision brief written → `agents/may/workspace/auto-loop-decision-brief.md`. Ready for Hao. |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |

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

## Latest Cycle Summary (13:13)
- **EXP-086 COMPLETE**: Mismatched few-shot 66.7%, matched 100%, baseline 12.5%. Two-level transfer: general principle transfers, specific procedure doesn't. H-091 updated.
- **CROSS-REFERENCE SKILL DISPATCHED**: Sent P1 to Coach — create `cross-reference-before-repair` skill with few-shot delivery. EXP-083 validated (100% across 4 domains).
- **BOB INTEGRATING EXP-086**: Running now, updating H-091, KE-059, PRIORITY-TRACKER, INDEX.md.
- **AUTO-LOOP BRIEF READY**: At `agents/may/workspace/auto-loop-decision-brief.md`. Waiting for Hao.
- **All agents healthy**: All heartbeats fired at 13:13. Only Amy-kimi still down (billing).

## Next Actions
- **P0**: **Present auto-loop decision brief to Hao** — Decision brief at `agents/may/workspace/auto-loop-decision-brief.md`. Need approval + implementation assignment.
- **P1**: **Monitor cross-reference skill deployment** — Dispatched to Coach this cycle. Verify skill created with few-shot delivery + committed.
- **P1**: **Monitor EXP-086 integration** — Bob running now. Verify H-091/KE-059/PRIORITY-TRACKER/INDEX updates.
- **P1**: **Plan few-shot skill conversion** — EXP-086 showed matched few-shot = 100%. Identify top text-rule skills to convert to few-shot format. (After Bob's integration completes.)
- **P1**: Federation design ready for Hao review — present summary when Hao is available
- **P2**: Scout C1.3 laggard intervention (76.3% vs 90%+ for others)
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
