# May's Supervisory Dashboard

Updated: 2026-04-08 ~07:05 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **All other 8 agents**: 🟢 Running normally

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production (NEW — Hao's directive)
4. Session digest system as unified recovery
5. Design docs before implementation

## What I'm Watching
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| Knowledge Application Audit | ✅ Complete | bob | 3 major gaps identified (KE-025, KE-029, KE-056) |
| KE-025 Skill Pruning | ✅ Complete | optimizer | Coach: 20→4 files (84%), Evaluator: 13→6 files (33%) — 90KB removed |
| EXP-075 CTA deployment | ✅ Complete | coach/may | Skill deployed (commit 188b98fe), SOUL.md updated (commit 6966f743) |
| EXP-076 Workflow audit | ✅ Phase 3 TRACKING | may | Bob now forking 5+ WORK sessions in 6h (was 0/24h). Workflow adoption improving. |
| EXP-077 Gym fidelity | ✅ Complete | coach | L1-L3 scenarios built and tested |
| KE-SUMMARIES completion | ✅ Done | bob | Extended 19→57 entries, all KEs covered + INDEX fixed |
| H-087 P3 retrospective | ✅ Done | bob | Designed experiments 2.05x more likely to produce KEs |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| Code cleanup — green items | ✅ Done | tech-lead | 8 files, -404 lines (commit bacdecd) |
| Code cleanup — medium items | ✅ Done | tech-lead | 4 files, +43/-37 lines (commit f7cf01b) — getAgentDir, BASH_WRITE_PATTERNS, loaded[] simplification, re-export consolidation |
| Code cleanup — architecture review | ✅ Done | bob | Reviewed requests.ts lazy/eager + loaded[] — both safe to simplify |
| Code cleanup — larger items impl | ✅ Done | tech-lead | lazy→eager (4 files) + loaded[] simplification — merged to main (commit 2372c03) |
| EXP-080 Growth Cycle (L2 skill) | ✅ Complete | coach | Cross-ref skill: 33%→67% (+34pp). Not promoted — L2 unreliable vs L3 100%. Intervention dosage model confirmed. |
| EXP-081 KE-002 Reexamination | ✅ Complete | coach | 0/12 across all 4 text rule categories. KE-002 **STRENGTHENED** — text rules don't fix judgment regardless of category. |
| EXP-082 Knowledge Application Pipeline | ✅ Complete | coach | P(applies\|pushed) ≈ 0. Agents ignore injected declarative knowledge even when directly relevant. KE-058 created. |
| H-089 Env Evidence Discovery | ✅ Complete | bob | Filed + integrated. P(H)=0.65→0.70 with EXP-080 dosage data. Complements H-085 (absent-info vs present-but-wrong). |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
| EXP-082 Knowledge Application Pipeline | Apr 8 | P(applies\|pushed) ≈ 0. Agents ignore injected knowledge. KE-058 created. Knowledge dead zone extends from access to application. |
| EXP-081 KE-002 Reexamination | Apr 8 | 0/12 across 4 text rule categories. KE-002 strengthened: 0/32 total. Text rules never fix judgment. |
| H-089 Environmental Evidence Discovery | Apr 8 | Filed by Bob. P(H)=0.70. Complements H-085 — covers absent-info failures via evidence discovery. |
| EXP-080 Growth Cycle (L2 skill) | Apr 8 | Cross-ref skill: baseline 33% → treatment 67% (+34pp). Not promoted — unreliable self-activation. Confirms intervention dosage model: L2 < L3 < L5. |
| EXP-079 Cross-reference breakthrough | Apr 8 | **100% pass rate on L3** (+100pp). External evidence > self-reflection for absent-field detection |
| EXP-078 Externalization on L3 | Apr 8 | 0% — correctly diagnosed schema gap, led to EXP-079 |
| EXP-077 Gym fidelity | Apr 8 | L1-L3 scenarios built and tested |
| Knowledge application audit | Apr 8 | Bob: KNOWLEDGE-APPLICATION-AUDIT.md — 3 gaps, 4 recommendations |
| Sprint 31 experiment designs | Apr 8 | Coach: EXP-075/076/077 designed + sprint plan |
| KE-SUMMARIES 57/57 | Apr 8 | Bob: All knowledge entries now have summaries |
| H-087 P3 retrospective | Apr 8 | Bob: Designed exps 2.05x better (p≈0.013) |
| finish() commit guard | Apr 7 | **SHIPPED** — commit 5babdf8, L5 enforcement for agent git commits |
| KE-053 Competency-Production Gap | Apr 7 | Bob synthesized EXP-065/066 findings (22 ops) |
| Workflow adoption investigation | Apr 7 | Optimizer: workflows were running but DB metadata was broken (fixed) |
| Agent busywork fix | Apr 6 | All 3 agents fixed — journal refs removed |
| Research DB tables | Apr 7 | knowledge, hypotheses, experiments tables live |
| Session digest Phases 1-4b | Apr 6 | Shipped and working |
| Anti-busywork campaign | Apr 6 | Bob, Coach, Optimizer heartbeats fixed |

## Latest Cycle Summary (07:05)
- **EXP-081 COMPLETE**: KE-002 STRENGTHENED. 0/12 passes across all 4 text rule categories (identity, procedural, preference, domain knowledge). Text rules don't fix judgment failures regardless of framing. Total evidence now 0/32.
- **EXP-082 COMPLETE — MAJOR FINDING**: P(applies|pushed) ≈ 0. Agents don't use injected declarative knowledge even when it directly contradicts their task. KE-058 created. This means the knowledge utilization dead zone extends from ACCESS to APPLICATION — even perfectly delivered knowledge is ignored.
- **H-089 COMPLETE**: Bob filed + integrated Environmental Evidence Discovery. P(H) 0.65→0.70 with EXP-080 dosage data.
- **Bob & Coach both self-dispatching well**: Bob processed EXP-080 results, Coach ran EXP-082 — all autonomous.
- **Zombie session killed**: s_1775311714523_3 finally cancelled (was 88h+).
- **System Health**: All 8 agents running normally. Amy-kimi still 🔴 DOWN.

## Next Actions
- **P1**: EXP-082 implication → knowledge must be encoded as WORKFLOWS/SKILLS, not declarations. This validates the structural enforcement thesis (KE-002 + KE-058). Coach/Bob should design structural knowledge gates.
- **P1**: EXP-079 cross-reference → deploy as L3 task instruction (not L2 skill per EXP-080) for config repair scenarios
- **P1**: Monitor Bob's workflow adoption (EXP-076 Phase 3) — need continued data
- **P2**: Archive completed "What I'm Watching" items — dashboard is getting long
- **P2**: EXP-082 Test 2 (KE-010 ceiling) and Test 3 (KE-002 text rules) still pending if Coach has bandwidth
