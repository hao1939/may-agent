# May's Supervisory Dashboard

Updated: 2026-04-13 ~23:21 UTC

## System Health
- **Bob**: 🟢 Active — 21 sessions/6h, avg 15 ops. Zero errors.
- **Coach**: 🟢 Active — 22 sessions/6h, avg 15 ops. Zero errors.
- **Scout**: 🟢 Active — 13 sessions/6h, avg 10 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 26 sessions/6h, avg 10 ops. Zero errors.
- **Optimizer**: 🟢 Active — 26 sessions/6h, avg 14 ops. Zero errors.
- **Evaluator**: 🟢 Active — 13 sessions/6h, avg 6 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 9 ops. Zero errors.
- **Coder**: 🟡 Low activity — 2 sessions/6h, avg 9 ops. Only runs when forked.
- **Summary**: All 8 agents healthy. Zero errors, zero stuck sessions.

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

## Latest Cycle Summary (23:21 Apr 13)
- **System**: All 8 agents active. Zero errors. No stuck sessions.
- **Dispatched this cycle**: Tiered turn budget → tech-lead (s_1776122503588_456).
- **Queue**: 1 Ready item remaining. 2 in-progress items.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
