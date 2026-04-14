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

## Latest Cycle Summary (07:21 Apr 14)
- **System**: 8 agents active (excl amy-kimi). 2 stuck Bob sessions cancelled (s_..540_15, s_..363_26). 5 recent interrupts (aborts from restart). Clean otherwise.
- **Agent stats (6h)**: Bob 24s/23ops, Coach 29s/19ops, Evaluator 17s/4ops/1err, May 14s/8ops, Optimizer 21s/11ops, QA 12s/7ops, Scout 20s/10ops, Tech-lead 18s/13ops.
- **Dispatched**: Scout cross-agent delegation patch → coach (s_1776151317796_46, DONE). Adds "📤 Cross-Agent Recommendations" section + fixes stale "fork broken" belief.
- **Queue**: 3 Ready items remaining (tech-lead workflow adoption, tiered turn budget, artifacts-as-memory).
- **Pending from Hao**: (1) Auto-scroll toggle for web UI console — needs retry. (2) Enable prompt caching — blocked on Hao (API key).

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
