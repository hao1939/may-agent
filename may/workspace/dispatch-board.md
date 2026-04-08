# May's Supervisory Dashboard

Updated: 2026-04-08 ~11:20 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Bob**: 🟡 1 transient error (JSON Parse EOF at 10:44) — self-healed, currently running fine
- **Coach**: 🟢 EXP-083 completed successfully despite earlier interruptions (results committed at 11:13).
- **All other agents**: 🟢 Running normally

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
| Structural knowledge enforcement | 🔄 ACTIVE | coach/bob | EXP-084 complete — few-shot breaks the binary (33% vs 0% baseline). KE-059 created. Next: combined treatment test? |
| EXP-076 Workflow audit | ✅ Phase 3 TRACKING | may | Bob now forking 5+ WORK sessions in 6h (was 0/24h). Workflow adoption improving. |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
| Federation Design (Local ↔ K3s) | Apr 8 | Bob produced 558-line design doc. Recommends Enhanced Git Federation, no new infra, 5-phase migration. Ready for Hao review. |
| EXP-083 Cross-Reference Generalization | Apr 8 | **MAJOR**: 100% treatment vs 0% baseline across 2 new domains. Cross-reference skill generalizes perfectly. H-089 → Tier 1 (P(H)=0.92). |
| EXP-084 Skill Training Method Comparison | Apr 8 | **MAJOR**: Few-shot breaks the binary! 33% pass, avg 4.3/5 (+2.3 from baseline 2.0/5). Checklist +2.0, Echo +1.3, Negative 0. Mechanism hierarchy L1→L5 established. KE-059 created. |
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

## Latest Cycle Summary (11:20)
- **Federation Design DONE**: Hao requested federation design for Local ↔ K3s coordination. Dispatched to Bob → completed 558-line design doc (`agents/shared/research-projects/federation-design.md`). Recommends Enhanced Git Federation with 5-phase migration, no new infra needed. Duplicate request cleaned up.
- **EXP-083 COMPLETE — MAJOR RESULT**: Cross-reference generalization confirmed! 24/24 (100%) treatment vs 0/24 (0%) baseline across 2 new domains (env-repair + schema-migration). H-089 promoted to Tier 1 (P(H)=0.92). Bob already integrated results.
- **Bob transient error**: JSON Parse EOF at 10:44, self-healed. Currently running normally.
- **System overall**: All 8 active agents running. Amy-kimi still DOWN.

## Next Actions
- **P1**: Federation design ready for Hao review — present summary and ask about truncated task description
- **P1**: Deploy cross-reference skill to production — EXP-083 confirmed 100% generalization, this is the highest-confidence intervention we have
- **P1**: Apply EXP-084 findings — convert existing text-rule skills to few-shot format (highest-impact change)
- **P1**: Scout intervention for C1.3 laggard behavior (76.3% vs 90%+ for others)
- **P2**: Propose combined treatment (few-shot + checklist) follow-up experiment
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
