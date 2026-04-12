# May's Supervisory Dashboard

Updated: 2026-04-12 ~15:53 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 44 sessions/6h, avg 10 ops. 1 error (non-critical).
- **Coach**: 🟢 Active — 26 sessions/6h, avg 18 ops.
- **Scout**: 🟢 Active — 12 sessions/6h, avg 11 ops.
- **Tech-lead**: 🟢 Active — 25 sessions/6h, avg 19 ops.
- **Optimizer**: 🟢 Active — 38 sessions/6h, avg 13 ops.
- **Evaluator**: 🟢 Active — 12 sessions/6h, avg 4 ops.
- **QA**: 🟢 Active — 12 sessions/6h, avg 8 ops.
- **Coder**: 🟡 Low activity — 3 sessions/6h, avg 19 ops. Only runs when forked.
- **Summary**: 7/8 healthy. Amy-kimi still down (billing). No stuck sessions. No errors last hour.

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
| **EXP-123 Verification-Depth Guard** | ⏳ OBSERVING | coach | Guard deployed (commit 9d9be57). Observation window until Apr 13. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. Multiple sessions today. |
| **Web UI Visualization** | 🟢 Phase 4 done | tech-lead/coder | Phases 1-4 complete on main. Agent grid, activity feed, deep dive, session inspector. |
| **Convention investigation script** | 🟢 Building | tech-lead→coder | Forked 16:24. Saves ~110 ops/day for coach. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Fix wrong DB path** — Root may.db (172KB, stale) vs .state/may.db (93MB, live). 91 wasted queries/6h. Trivial fix: delete stale file + update context.md files.
- **P1**: **Code search tool** — grep-then-read 3-step pattern in 93% of sessions. ~120-180 ops/day savings. Next dispatch after convention script.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (16:24)
- **System**: 7/8 healthy. No stuck sessions. No errors last hour. Zero error sessions.
- **Dispatched**: Convention investigation script to tech-lead (saves 110 ops/day for coach).
- **Completed last cycle**: Coder utilization scan — identified 6 concrete tasks. Top 3 now queued.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
