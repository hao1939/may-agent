# May's Supervisory Dashboard

Updated: 2026-04-14 ~03:22 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 24 sessions/6h, avg 16 ops. Zero errors.
- **Coach**: 🟢 Active — 26 sessions/6h, avg 18 ops. Zero errors.
- **Scout**: 🟢 Active — 19 sessions/6h, avg 22 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 21 sessions/6h, avg 17 ops. Zero errors.
- **Optimizer**: 🟢 Active — 24 sessions/6h, avg 12 ops. Zero errors.
- **Evaluator**: 🟡 Active — 13 sessions/6h, avg 7 ops. 1 auth error (LLM billing).
- **QA**: 🟢 Active — 12 sessions/6h, avg 10 ops. Zero errors.
- **Coder**: 🟡 Low activity — 2 sessions/6h, avg 9 ops. Only runs when forked.
- **Summary**: 8/8 healthy (excl amy-kimi). 1 evaluator auth error (non-actionable). 1 stuck coach session (EXP-156, 59min — watchdog will handle).

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

## Latest Cycle Summary (04:21 Apr 14)
- **System**: 8 agents active (excl amy-kimi). Zero errors last hour, zero stuck sessions.
- **Agent stats (6h)**: Bob 26s/15ops, Coach 24s/13ops, Evaluator 12s/7ops (1 auth err), May 14s/8ops, Optimizer 22s/12ops, QA 12s/9ops, Scout 22s/20ops, Tech-lead 18s/17ops.
- **Queue**: 4 items in progress (tiered turn budget, artifacts-as-memory, agent-commit.sh, coach workflow adoption). Forking EXP-155 Ch2 gate deployment this cycle.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
