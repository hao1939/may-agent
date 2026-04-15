# May's Supervisory Dashboard

Updated: 2026-04-15 ~06:30 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 4 sessions/6h, avg 10 ops. Zero errors.
- **Coach**: 🟢 Active — 5 sessions/6h, avg 13 ops. Zero errors.
- **Scout**: 🟢 Active — 3 sessions/6h, avg 12 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 3 sessions/6h, avg 4 ops. Zero errors.
- **Optimizer**: 🟢 Active — 5 sessions/6h, avg 11 ops. Zero errors.
- **Evaluator**: 🟢 Active — 8 sessions/6h, avg 1 ops. Zero errors.
- **QA**: 🟢 Active — 4 sessions/6h, avg 5 ops. Zero errors.
- **Coder**: 🟡 Low activity — Only runs when forked by tech-lead.
- **Summary**: 7/8 healthy. Amy-kimi still down. No errors, no stuck sessions. All agents running normally. Lower session counts reflect overnight period.

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

## Latest Cycle Summary (06:30 Apr 15)
- **System**: 8 agents active (excl amy-kimi). Zero errors, no stuck sessions. Clean overnight.
- **Agent stats (6h)**: Bob 4s/10ops, Coach 5s/13ops, Evaluator 8s/1ops, May 2s/2ops, Optimizer 5s/11ops, QA 4s/5ops, Scout 3s/12ops, Tech-lead 3s/4ops.
- **In Progress**: Optimizer finding→dispatch pipeline, Tech-lead workflow D-o-R (optimizer).
- **Queue**: 2 Ready items. Top: tiered turn budget deployment (dispatching to tech-lead), artifacts-as-memory deep dive (bob).

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
