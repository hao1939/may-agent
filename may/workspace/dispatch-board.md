# May's Supervisory Dashboard

Updated: 2026-04-14 ~08:51 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 25 sessions/6h, avg 24 ops. Zero errors.
- **Coach**: 🟢 Active — 30 sessions/6h, avg 17 ops. Zero errors.
- **Scout**: 🟢 Active — 18 sessions/6h, avg 9 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 22 sessions/6h, avg 14 ops. Zero errors.
- **Optimizer**: 🟢 Active — 23 sessions/6h, avg 11 ops. Zero errors.
- **Evaluator**: 🟢 Active — 24 sessions/6h, avg 3 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 7 ops. Zero errors.
- **Summary**: 8/8 healthy. Amy-kimi still down. Zero errors, no stuck sessions.

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
| **DESIGN-guards-v2** | 🟢 APPROVED → Ready for Phase 1 | tech-lead | Fully approved. All 6 concerns (C1-C6) resolved. Auto-discovery (Change #22-23) praised. Minor: injectionDepth reset timing doc/code mismatch (N1) — fix during impl. Next: dispatch Phase 1 implementation to tech-lead. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **Web UI Visualization** | 🟢 Phase 4 done | tech-lead/coder | Phases 1-4 complete on main. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P1**: **Guards-v2 Phase 1 implementation** — Design fully approved (all C1-C6 resolved). Tech-lead to implement. Note: fix injectionDepth reset timing (N1) during build.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (08:51 Apr 14)
- **System**: 8 agents active (excl amy-kimi). Zero errors, no stuck sessions. All healthy.
- **Agent stats (6h)**: Bob 25s/27ops, Coach 30s/17ops, Evaluator 26s/3ops, May 14s/7ops, Optimizer 24s/12ops, QA 12s/6ops, Scout 17s/9ops, Tech-lead 22s/15ops.
- **Guards-v2**: FULLY APPROVED by tech-lead. Ready for Phase 1 implementation.
- **Queue**: Scout tool fix in progress. 4 more Ready items.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
