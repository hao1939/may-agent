# May's Supervisory Dashboard

Updated: 2026-04-08 ~12:35 UTC

## System Health
- **System restarted** at 12:04 UTC after 2h model routing outage (09:02–11:02). Outage hit all agents: `claude-opus-4.6` and `gpt-5.2` unavailable on proxy. Now resolved.
- **Bob**: 🟢 Running — integrating EXP-085 results into KE-059, H-091 (forked work session s_1775651603919_4).
- **Coach**: 🟢 Running — forked EXP-086 (combined few-shot+checklist) and EXP-087 (mismatched few-shot boundary test).
- **May**: 🟢 Running (this session).
- **Tech-lead**: ✅ Done — completed heartbeat, noted model routing issue.
- **Evaluator/Optimizer/Scout/QA**: ⏳ Waiting — heartbeats scheduled to fire over next 25 min (normal post-restart stagger).
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Amy**: ⚪ Disabled (heartbeat off).

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
| EXP-085 Knowledge Integration | 🔄 RUNNING | bob | Bob updating KE-059 with cross-scenario replication data, updating H-091 and index. Session s_1775651603919_4. |
| EXP-086 Combined Treatment | 🔄 RUNNING | coach | Few-shot + checklist synergy test on contradictory-requirements (N=6). Session s_1775651645741_5. |
| EXP-087 Boundary Test | 🔄 RUNNING | coach | Mismatched few-shot structural similarity test — does domain-mismatched example still work? Session s_1775651660950_6. |
| Autoresearch Investigation | ⏳ DISPATCHED | scout | Hao req from Mar 20 (req:1c42f66e). Dispatched to scout last cycle (req:1259fbec). Scout heartbeat fires ~12:55. |
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

## Latest Cycle Summary (12:35)
- **Post-outage recovery**: System restarted at 12:04 after 2h model routing outage. Core agents (may, bob, coach, tech-lead) recovered. Evaluator/optimizer/scout/qa will fire over next 25 min.
- **Bob integrating EXP-085**: Updating KE-059 with cross-scenario replication evidence (escalation-judgment 100% vs 12.5% baseline).
- **Coach running 2 new experiments**: EXP-086 (combined few-shot+checklist on contradictory-requirements) and EXP-087 (mismatched domain few-shot boundary test). Both autonomously designed and forked.
- **16 error sessions** during outage (09:02–11:02) — all from model routing. No agent bugs.
- **Amy-kimi still DOWN**: 429 errors, blocked on Hao for billing fix.

## Next Actions
- **P1**: **Convert text-rule skills to few-shot format** — EXP-085 confirmed generalization. Coach should start converting highest-impact text-rule skills to few-shot. This is the Knowledge APPLICATION priority.
- **P1**: **Deploy cross-reference skill to production** — EXP-083 confirmed 100% generalization, M2 mechanism validated.
- **P1**: Federation design ready for Hao review — present summary when Hao is available
- **P2**: Scout C1.3 laggard intervention (76.3% vs 90%+ for others)
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: Design next experiment — what skill/scenario to apply few-shot to next?
