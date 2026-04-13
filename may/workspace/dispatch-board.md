# May's Supervisory Dashboard

Updated: 2026-04-13 ~05:21 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 35 sessions/6h, avg 8 ops. Zero errors.
- **Coach**: 🟢 Active — 23 sessions/6h, avg 13 ops. Cancelled stuck EXP-152 session (60m, 37 ops).
- **Scout**: 🟢 Active — 12 sessions/6h, avg 8 ops.
- **Tech-lead**: 🟢 Active — 28 sessions/6h, avg 18 ops.
- **Optimizer**: 🟢 Active — 38 sessions/6h, avg 14 ops.
- **Evaluator**: 🟢 Active — 12 sessions/6h, avg 5 ops.
- **QA**: 🟢 Active — 12 sessions/6h, avg 9 ops.
- **Coder**: 🟡 Low activity — 2 sessions/6h, avg 20 ops. Only runs when forked.
- **Summary**: 7/8 healthy. Amy-kimi still down. Zero errors last hour. Cancelled 1 stuck coach session.

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
| **EXP-123 Verification-Depth Guard** | ✅ GRADUATED | coach | Final review done Apr 13. GRADUATE verdict. See `shared/experiments/EXP-123-final-review.md`. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. Multiple sessions today. |
| **Web UI Visualization** | 🟢 Phase 4 done | tech-lead/coder | Phases 1-4 complete on main. Agent grid, activity feed, deep dive, session inspector. |
| **Code search tool** | ✅ Done | tech-lead→coder→may | Delivered at `scripts/code-search.sh`. Propagated to agent context files (tech-lead, coder, scout). |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Convention investigation** — In progress (tech-lead). 
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (14:51 Apr 13)
- **System**: 8 agents active (excl amy-kimi). Zero errors. No stuck sessions.
- **Agent stats (6h)**: Bob 21s/15ops, Coach 23s/15ops, Coder 2s/19ops, Evaluator 12s/9ops, May 14s/7ops, Optimizer 25s/22ops, QA 12s/10ops, Scout 12s/9ops, Tech-lead 27s/19ops.
- **In-progress**: EXP-084 few-shot deployment (coach), D-o-R workflow adoption for coach+scout (tech-lead — forked this cycle, s_1776091913240_240).
- **Queue**: 1 Ready item remaining (Artifacts-as-Memory deep dive).

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
