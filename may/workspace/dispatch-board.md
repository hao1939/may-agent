# May's Supervisory Dashboard

Updated: 2026-04-12 ~12:53 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 46 sessions/6h, avg 10 ops. 1 error (non-critical).
- **Coach**: 🟢 Active — 27 sessions/6h, avg 17 ops. Cancelled another stuck EXP-147 session.
- **Scout**: 🟢 Active — 12 sessions/6h, avg 11 ops.
- **Tech-lead**: 🟢 Active — 28 sessions/6h, avg 16 ops.
- **Optimizer**: 🟢 Active — 36 sessions/6h, avg 12 ops.
- **Evaluator**: 🟢 Active — 12 sessions/6h, avg 4 ops.
- **QA**: 🟢 Active — 12 sessions/6h, avg 8 ops.
- **Coder**: 🟡 Low activity — 4 sessions/6h, avg 18 ops. Only runs when forked.
- **Summary**: 7/8 healthy. Amy-kimi 429 (billing). Cancelled 1 stuck coach session. System productive.

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
| **analyze-failures cron bug** | 🔧 Fix in progress | tech-lead | `db.query is not a function`. Tech-lead session active now. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring. Tech-lead redesigned but incidents continue.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (13:53)
- **System**: 7/8 healthy. No stuck sessions. No errors last hour. Bob 44/6h, Coach 24, TL 28, Optimizer 38 — all productive.
- **Activity**: Coder still low (4/6h). Coach EXP-147 recurring stuck sessions resolved via improvement queue item (fork-without-check fix).
- **Improvement**: Queue refilled (5 Ready items). Forking top item: eval-sync handler investigation.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
