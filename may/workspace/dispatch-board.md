# May's Supervisory Dashboard

Updated: 2026-04-08 ~13:05 UTC

## System Health
- **Bob**: 🟢 Running heartbeat — EXP-085 integration DONE (committed). Now on new heartbeat cycle.
- **Coach**: 🟢 Running — forked EXP-087 writeup (s_1775653398151_11) and EXP-086 resume (s_1775653407915_12). EXP-087 has results: mismatched few-shot 0/3 on escalation (matched=100%), 2/3 on contradictory-req (matched=33%).
- **Tech-lead**: 🟢 Running heartbeat.
- **May**: 🟢 Running (this session).
- **Scout**: 🔴 **DOWN 16 DAYS** — model `claude-opus-4.6` invalid for scout's API key. Last success: Mar 23. NOT the temporary outage — persistent config issue. Blocked on Hao.
- **Optimizer**: 🔴 **DOWN 16 DAYS** — same `claude-opus-4.6` model name error. Last success: Mar 23. Blocked on Hao.
- **Evaluator**: 🔴 **DOWN 16 DAYS** — model `gpt-5.2` invalid. Last success: Mar 23. Blocked on Hao.
- **QA**: 🔴 **DOWN 16 DAYS** — model `gpt-5.2` invalid. Last success: Mar 23. Blocked on Hao.
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Amy**: ⚪ Disabled (heartbeat off).
- **⚠️ 5 of 11 agents are DOWN. Only may/bob/coach/tech-lead/coder operational. Hao needs to fix model routing/API keys.**

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
| EXP-086 Combined Treatment | 🔄 RESUMED | coach | Was interrupted; coach re-forked as s_1775653407915_12. Running remaining trials. |
| EXP-087 Boundary Test | 🔄 WRITING UP | coach | **RESULTS IN**: Mismatched few-shot on escalation-judgment: **0/3** (matched=100%). Mismatched on contradictory-req: **2/3** (matched=33%). Domain match matters for escalation; structural pattern helps for contradictory-req. Coach writing results doc (s_1775653398151_11). |
| Autoresearch Investigation | 🔴 BLOCKED | scout | Hao req from Mar 20 (req:1c42f66e). **Scout DOWN** — model routing broken since Mar 23. Cannot execute. |
| Model routing: scout/optimizer | 🔴 BLOCKED 16 DAYS | Hao | `claude-opus-4.6` not in available models for these agents' API keys. Silently failing since Mar 23. |
| Model routing: evaluator/qa | 🔴 BLOCKED 16 DAYS | Hao | `gpt-5.2` not in available models for these agents' API keys. Silently failing since Mar 23. |
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

## Latest Cycle Summary (13:05)
- **🔴 CRITICAL: 5 agents DOWN for 16 days.** Scout, optimizer, evaluator, and QA have been failing since Mar 23 with model name errors (`claude-opus-4.6` and `gpt-5.2` not available on their API keys). This was masked by the temporary model routing outage today but is a separate, persistent config issue. Amy-kimi also down (billing). **Only may/bob/coach/tech-lead/coder are operational.**
- **Bob**: EXP-085 knowledge integration DONE and committed. Now on fresh heartbeat cycle.
- **Coach**: EXP-087 complete with interesting results — mismatched few-shot degrades escalation-judgment from 100%→0% but improves contradictory-req from 33%→67%. Domain match critical for complex scenarios, structural pattern alone helps simpler ones. Coach also re-forked interrupted EXP-086.
- **Autoresearch** (Hao req, 19 days overdue): Blocked on scout model routing fix.
- **EXP-086** (few-shot+checklist combined): Resumed by coach after interruption.

## Next Actions
- **P0**: **🔴 ESCALATE TO HAO: Model routing broken for 4 agents since Mar 23.** Scout/optimizer need `claude-opus-4.6`, evaluator/qa need `gpt-5.2` — both model names return 400 "Invalid model name" on their API keys. These agents have been silently failing for 16 days. All heartbeat attempts result in immediate error. Fix: either update model names to valid ones, or fix proxy routing for these keys.
- **P1**: **Convert text-rule skills to few-shot format** — EXP-085 confirmed generalization. Coach should start converting highest-impact text-rule skills to few-shot. This is the Knowledge APPLICATION priority.
- **P1**: **Deploy cross-reference skill to production** — EXP-083 confirmed 100% generalization, M2 mechanism validated.
- **P1**: Federation design ready for Hao review — present summary when Hao is available
- **P2**: Scout C1.3 laggard intervention (76.3% vs 90%+ for others) — BLOCKED on scout model fix
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: Design next experiment — what skill/scenario to apply few-shot to next?
