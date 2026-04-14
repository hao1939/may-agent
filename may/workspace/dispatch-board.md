# May's Supervisory Dashboard

<<<<<<< Updated upstream
Updated: 2026-04-14 ~05:03 UTC

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
=======
Updated: 2026-04-14 ~16:21 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 29 sessions/6h, avg 13 ops, 0 errors.
- **Coach**: 🟢 Active — 30 sessions/6h, avg 15 ops, 0 errors.
- **Scout**: 🟢 Active — 12 sessions/6h, avg 6 ops, 0 errors.
- **Tech-lead**: 🟢 Active — 25 sessions/6h, avg 20 ops, 0 errors.
- **Optimizer**: 🟢 Active — 20 sessions/6h, avg 16 ops, 0 errors.
- **Evaluator**: 🟢 Active — 66 sessions/6h, avg 1 op, 0 errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 7 ops, 0 errors.
- **Coder**: 🟢 Active — 11 sessions/6h, avg 18 ops, 0 errors.
- **Summary**: 9/9 healthy. Amy-kimi still down. No stuck sessions. Only interrupts (request aborts), no real errors.
>>>>>>> Stashed changes

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production
4. Session digest system as unified recovery
5. Design docs before implementation

## Active Items
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
<<<<<<< Updated upstream
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| **EXP-123 Verification-Depth Guard** | ✅ GRADUATED | coach | Final review done Apr 13. GRADUATE verdict. See `shared/experiments/EXP-123-final-review.md`. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. Multiple sessions today. |
| **Web UI Visualization** | 🟢 Phase 4 done | tech-lead/coder | Phases 1-4 complete on main. Agent grid, activity feed, deep dive, session inspector. |
| **Code search tool** | ✅ Done | tech-lead→coder→may | Delivered at `scripts/code-search.sh`. Propagated to agent context files (tech-lead, coder, scout). |
=======
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still down, needs balance refill |
| **Guards-v2 Phase 1** | ✅ COMPLETE | may/tech-lead | All 4 gaps closed. 53 tests pass. Warning delivery, guard disable, demand dedup, auto-test guard. |
| **Guards-v2 Phase 2: Integration test** | ✅ COMPLETE | tech-lead | Done (23 ops). Guards tested in real workflow execution. |
| **Pivot-detector guard** | 🟢 IN REVIEW | may | Detects create-test-fail loops (bob 280ops, coach 118ops). Warns at 3, intervenes at 5. 7 tests. Branch: review/pivot-detector-guard. |
| **Batch merge tool** | 🟢 DISPATCHED | tech-lead | Forked s_1776183713962_246. Script to automate review branch merges. Saves ~40 ops/session. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **EXP-156 Hard Gate Generalization** | 🟢 RUNNING | coach | Phase 4 analysis underway. |
| **Over-intervention dedup** | ✅ DONE | coach | Removed 5 redundant evidence-over-narrative copies. Canonical at shared/knowledge/fewshot-examples/. Commit: 2cd4dfd7. |
| **Artifacts-as-Memory deep dive** | 📋 P1 QUEUED | bob | Paper 2604.08756 validates DD-750. Write DD + cross-ref. |
| **Verify-wrap "undefined" bug** | 🟡 IN REVIEW | may | Fix on branch `review/fix-verify-wrap-undefined`. 97 tests pass. Needs QA merge. |
| **Gym scenario triage + lab merge** | 🟢 DISPATCHED | bob | Design doc for 295→30-50 scenarios + lab→gym merge. Req b0d82f98. |
| **Lab fork cleanup** | 🟢 DISPATCHED | coach | Audit 55 .lab/ forks, delete stale. Req c724e8ee. |
| **Gym cost/value analysis** | 🟢 DISPATCHED | optimizer | 952 sessions/week cost analysis. Req 7e06acd1. |
| **Web UI Visualization** | ✅ Phase 4 done | tech-lead/coder | Complete. |
| **Scout archetype tool fix** | ✅ DONE | — | agent.json already has agents + workflow tools. |
| **Workspace hygiene script + cleanup** | 🟢 DISPATCHED | tech-lead | Prune stale archives (bob 5.8MB, coach 2.3MB, optimizer 2.0MB). Req de6620e5. |
| **Commit guard scope gap** | 🟢 DISPATCHED | tech-lead | Guard only checks agents/<name>/, misses src/ and shared/. Req ebefef5a. |
>>>>>>> Stashed changes

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Convention investigation** — In progress (tech-lead). 
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (05:03 Apr 14)
- **System**: 8 agents active (excl amy-kimi). 1 evaluator error, 1 bob zombie session. Otherwise clean.
- **Agent stats (6h)**: Bob 28s/15ops, Coach 28s/15ops, Evaluator 12s/7ops, May 14s/9ops, Optimizer 22s/12ops, QA 12s/8ops, Scout 22s/20ops, Tech-lead 19s/22ops.
- **Completed since last cycle**: Guard-redirect prototype (phase 1 design + test), event-driven guards design, session event flow design.
- **Queue**: 5 Ready items in improvement queue. Top: over-intervention cleanup, tech-lead workflow adoption, tiered turn budget.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
