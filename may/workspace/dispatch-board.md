# May's Supervisory Dashboard

Updated: 2026-04-08 ~14:03 UTC

## System Health
- **Bob**: 🟢 Running heartbeat — looking to delegate EXP-070 to coach once current experiments complete.
- **Coach**: 🟢 Running heartbeat. EXP-087 COMPLETE. EXP-086 queued for retry (req:1780170e, 28min). Growth trigger for Bob FM-3.3 received (should SKIP — EXP-057 showed FM-3.3 at ceiling).
- **Tech-lead**: 🟢 Running heartbeat — confirmed model routing is infra/proxy issue, not agent config.
- **May**: 🟢 Running (this session).
- **Evaluator**: 🟢 **BACK UP!** Last 3 sessions succeeded (13:34, 14:02, 14:02). Model `gpt52` now resolving correctly. Was down since ~Mar 23.
- **Scout**: 🔴 **DOWN 16 DAYS** — model `claude-opus-4.6` invalid. Last attempt 09:34 (error). Heartbeat appears stopped (circuit-breaker?). Blocked on Hao.
- **Optimizer**: 🔴 **DOWN 16 DAYS** — same `claude-opus-4.6` error. Last attempt 10:34. Heartbeat appears stopped. Blocked on Hao.
- **QA**: 🔴 **DOWN 16 DAYS** — model `gpt-5.2` invalid. Last attempt 10:34. Heartbeat appears stopped. Blocked on Hao.
- **Amy-kimi**: 🔴 DOWN — No API key for provider: openai. Last attempt Apr 7 19:06. Blocked on Hao.
- **Amy**: ⚪ Disabled (heartbeat off).
- **⚠️ 4 of 11 agents are DOWN (was 5 — evaluator recovered!). Scout/optimizer/QA/amy-kimi still broken. Hao needs to fix model routing/API keys.**

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
| EXP-085 Knowledge Integration | ✅ DONE | bob | Bob completed integration — all 6 files verified and committed (12:40 UTC). |
| EXP-086 Combined Treatment | ⏳ QUEUED RETRY | coach | 3 sessions so far (interrupted × 2, GYM_AGENT_BIN fail × 1). Had partial runs (some 5/5 PASS). Coach has active request (req:1780170e) to retry. |
| EXP-087 Boundary Test | ✅ COMPLETE | coach | **KEY FINDING**: Few-shot transfer is asymmetric. Mismatched examples can HARM (escalation: 0/3 vs 12.5% baseline) or HELP (contradictory: 2/3=67% vs 0% baseline, p=0.018). Behavioral template compatibility matters more than domain match. Results at `EXP-087/results.md`. |
| Autoresearch Investigation | 🔴 BLOCKED | scout | Hao req from Mar 20 (req:1c42f66e). **Scout DOWN** — model routing broken since Mar 23. Cannot execute. |
| Model routing: scout/optimizer | 🔴 BLOCKED 16 DAYS | Hao | `claude-opus-4.6` not in available models for these agents' API keys. Silently failing since Mar 23. |
| Model routing: evaluator/qa | ✅ EVALUATOR FIXED / 🔴 QA STILL DOWN | Hao | Evaluator's `gpt52` model now resolves (3 successful sessions since 13:34). **QA still failing** with `gpt-5.2` — different model name? QA heartbeat appears stopped. |
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

## Latest Cycle Summary (14:03)
- **🟢 Evaluator BACK UP!** Model `gpt52` now resolving. 3 successful sessions since 13:34. Down count: 5→4 agents.
- **🔴 STILL DOWN: Scout, Optimizer, QA, Amy-kimi.** Scout/optimizer: `claude-opus-4.6` invalid. QA: `gpt-5.2` invalid. Amy-kimi: no OpenAI API key. All heartbeats appear stopped (circuit-breaker from repeated errors).
- **EXP-086**: Queued for retry by coach (req:1780170e). 3 prior sessions produced partial data (some 5/5 PASS runs) but all interrupted. Coach is in heartbeat now and should pick this up.
- **EXP-087**: COMPLETE and integrated by Bob. ✅
- **Coder s_1775655522855_0**: Active gym trial (24min), working normally — reading files, tests pass, writing results. Not stuck.
- **Bob FM-3.3 growth trigger**: Coach received this (req:34ff8d58) but should SKIP — EXP-057 showed all FM-3.3 scenarios at ceiling (5/5). No training opportunity.
- **tsc --noEmit**: False alarm — no tsconfig.json at project root.

## Next Actions
- **P0**: **🔴 ESCALATE TO HAO: Model routing still broken for 3 agents.** Scout/optimizer need `claude-opus-4.6`, QA needs `gpt-5.2`. Evaluator fixed itself — suggest Hao check what changed and apply similar fix to QA. Amy-kimi needs OpenAI API key.
- **P1**: **EXP-086 retry** — Coach should pick up req:1780170e this heartbeat. Combined few-shot + checklist is the key next experiment.
- **P1**: **EXP-087 integration** — Bob should create KE for few-shot template compatibility findings and update the mechanism hierarchy.
- **P1**: **Convert text-rule skills to few-shot format** — EXP-085 confirmed generalization. Coach should start converting highest-impact text-rule skills to few-shot.
- **P1**: **Deploy cross-reference skill to production** — EXP-083 confirmed 100% generalization, M2 mechanism validated.
- **P1**: Federation design ready for Hao review — present summary when Hao is available
- **P2**: Scout C1.3 laggard intervention (76.3% vs 90%+ for others) — BLOCKED on scout model fix
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: Design next experiment — what skill/scenario to apply few-shot to next?
