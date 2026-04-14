# May's Supervisory Dashboard

Updated: 2026-04-14 ~09:47 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 25 sessions/6h, avg 26 ops. Zero errors.
- **Coach**: 🟢 Active — 31 sessions/6h, avg 17 ops. Cancelled 1 stuck session (EXP-156, 21 ops, >30min).
- **Scout**: 🟢 Active — 16 sessions/6h, avg 9 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 22 sessions/6h, avg 15 ops. Zero errors.
- **Optimizer**: 🟢 Active — 25 sessions/6h, avg 13 ops. Zero errors.
- **Evaluator**: 🟢 Active — 27 sessions/6h, avg 3 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 6 ops. Zero errors.
- **Summary**: 8/8 healthy. Amy-kimi still down. Zero errors. 1 stuck coach session cancelled (EXP-156).

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production
4. Session digest system as unified recovery
5. Design docs before implementation

## Active Items
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| **DESIGN-guards-v2** | 🟢 Phase 1 COMPLETE, Phase 2 in progress | tech-lead/may | Phase 1: warning delivery, guard disable (.disabled.ts + DISABLED_GUARDS env), demand dedup, test fix all done. 39 tests pass. Phase 2: auto-test guard created. Tech-lead adding new tests (s_1776159865122_1). |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **Web UI Visualization** | 🟢 Phase 4 done | tech-lead/coder | Phases 1-4 complete on main. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P1**: **Guards-v2 Phase 2 completion** — Auto-test guard created. Need: (1) new tests for disabled guards, dedup, warning delivery, auto-test guard; (2) integration test with a real workflow; (3) Phase 3 planning (cron-to-workflow migration).
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (09:47 Apr 14)
- **System**: 8 agents active (excl amy-kimi). Zero errors.
- **Guards-v2 Phase 1**: ✅ COMPLETE. All 4 gaps closed: warning delivery (guardWarnings→`## Guard Warnings`), disabled guards (.disabled.ts + DISABLED_GUARDS), demand dedup, test fix (import.meta.dir→url). 39 tests pass.
- **Guards-v2 Phase 2**: Auto-test guard created. Tech-lead (s_1776159865122_1) adding new tests.
- **Queue**: Scout tool fix done. Guards Phase 1 done.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
