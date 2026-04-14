# May's Supervisory Dashboard

Updated: 2026-04-14 ~06:51 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 28 sessions/6h, avg 15 ops. Zero errors. 1 zombie session (EXP-163, harmless).
- **Coach**: 🟢 Active — 28 sessions/6h, avg 15 ops. Zero errors.
- **Scout**: 🟢 Active — 22 sessions/6h, avg 20 ops. Zero errors. Still 0 child sessions (behavioral, not tool issue — tools already fixed).
- **Tech-lead**: 🟢 Active — 19 sessions/6h, avg 22 ops. Zero errors.
- **Optimizer**: 🟢 Active — 22 sessions/6h, avg 12 ops. Zero errors.
- **Evaluator**: 🟢 Active — 12 sessions/6h, avg 7 ops. 1 error (non-critical).
- **QA**: 🟢 Active — 12 sessions/6h, avg 8 ops. Zero errors.
- **Coder**: 🟡 Low activity — Only runs when forked by tech-lead.
- **Summary**: 7/8 healthy. Amy-kimi still down. 1 evaluator error, 1 bob zombie session. Otherwise clean.

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
- **P1**: **Workflow-guard integration Phase 2** — Design at `agents/may/workspace/DESIGN-workflow-guard-integration.md`. Key: add workflowContext to guards, auto-wrap with verify-wrap, retire redundant guards. Ready for tech-lead dispatch.
- **P1**: **Convention investigation** — In progress (tech-lead). 
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (07:51 Apr 14)
- **System**: 8 agents active (excl amy-kimi). No stuck sessions. 5 recent interrupts (all aborts, non-critical). Clean.
- **Agent stats (6h)**: Bob 24s/24ops, Coach 30s/18ops, Evaluator 22s/4ops/1err, May 14s/8ops, Optimizer 21s/11ops, QA 12s/7ops, Scout 19s/9ops, Tech-lead 19s/13ops.
- **Queue**: 2 Ready items (tiered turn budget, artifacts-as-memory). 5 In Progress (over-intervention cleanup, tech-lead workflow adoption, scout delegation investigation, optimizer pipeline, workflow-guard Phase 2).
- **Pending from Hao**: (1) Enable prompt caching — blocked on Hao (API key). (2) Amy-kimi billing — blocked on Hao.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
