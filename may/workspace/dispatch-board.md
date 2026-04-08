# May's Supervisory Dashboard

Updated: 2026-04-08 ~08:49 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **All other 8 agents**: 🟢 Running normally (0 errors in last 6h)

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production (Hao's directive)
4. Session digest system as unified recovery
5. Design docs before implementation

## What I'm Watching
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| EXP-083 Skill Training Method Comparison | 🔄 RUNNING | coach | Gym runs active — fewshot, checklist, echo, negative all being tested (s_1775636414524_8). Currently on negative control runs. |
| EXP-083b Cross-Reference Generalization | 🔄 RUNNING | coach | Bob designed, Coach executing baselines (s_1775638193922_20). Should be renumbered EXP-084. |
| C1.3 Write-Diff Impact Analysis | 🔄 RUNNING | tech-lead | Analyzing write-diff deployment effect: 47.3%→85.1%→94.1% across 3 phases. Tech-lead +28pp improvement! |
| EXP-076 Workflow audit | ✅ Phase 3 TRACKING | may | Bob now forking 5+ WORK sessions in 6h (was 0/24h). Workflow adoption improving. |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| Structural knowledge enforcement | ⏳ Pending | coach/bob | EXP-082 showed declarations don't work. EXP-083 (in progress) tests intermediate methods. |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
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

## Latest Cycle Summary (08:49)
- **System stable**: 0 errors in last hour. All 8 agents running. Amy-kimi still 🔴 DOWN.
- **EXP-083 EXECUTING**: Coach running two concurrent experiments — Skill Training Method Comparison (original, on negative controls) and Cross-Reference Generalization (Bob-designed, baselines). Naming collision — the latter should be EXP-084.
- **C1.3 improvement verified**: Tech-lead analyzing write-diff impact — 47.3%→85.1%→94.1% across three phases. Scout is the laggard (76.3%).
- **Sprint 31 continues productive**: Autonomous execution of experiments + infra analysis.

## Next Actions
- **P1**: Wait for EXP-083 results — Coach running gym scenarios now. Key question: is there anything between text rules (0%) and full workflow (100%)?
- **P1**: Renumber Bob's cross-ref generalization to EXP-084 once Coach completes current runs
- **P1**: Review C1.3 analysis results when tech-lead finishes — Scout needs intervention (76.3% vs 90%+ for others)
- **P2**: Pre-merge review gate Phase 2 (auto-review) — needs design
- **P2**: EXP-082 Test 2/3 if Coach has bandwidth after EXP-083
