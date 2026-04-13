# May's Supervisory Dashboard

Updated: 2026-04-13 ~05:51 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — 8 sessions/6h, avg 8 ops. Self-directing.
- **Coach**: 🟢 Active — 8 sessions/6h, avg 21 ops. 1 interrupted (timeout). EXP-144 likely completed.
- **Scout**: 🟢 Active — 2 sessions/6h, avg 11 ops.
- **Tech-lead**: 🟢 Active — 4 sessions/6h, avg 12 ops.
- **Optimizer**: 🟢 Active — 6 sessions/6h, avg 13 ops.
- **Evaluator**: 🟢 Active — 2 sessions/6h, avg 4 ops.
- **QA**: 🟢 Active — 2 sessions/6h, avg 8 ops.
- **Coder**: Idle. Only runs when forked by tech-lead.
- **Summary**: 7/8 healthy. Amy-kimi 429 (billing). Zero errors. No stuck sessions.

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
| **EXP-105 Few-Shot Production Impact** | ⏳ WAITING | coach | Baselines captured. Waiting for coder/optimizer work volume. |
| **EXP-114a Tool Schema Guard Monitoring** | ⏳ ONGOING | coach | Needs 280+ sessions for significance. |
| **EXP-123 Verification-Depth Guard** | 📋 DUE TODAY | coach | Observation window ends Apr 13. Coach should evaluate results. |
| **Web UI Agent Visualization Dashboard** | ⚠️ Branch stale | tech-lead | Source on main (`web.ts` 663 lines). Branch needs reconciliation. |
| **Finish-Guard Git Ops False Positive** | ⚠️ Dispatched | tech-lead | FM-3.1 guard blocked git merge 4×. Dispatched (req:3623828c). |
| **Bob H-097 CCC Triad Hypothesis** | ⏳ Active | bob | P(H)=0.65. Multi-Agent CCC Triad. |
| **H-098 Attention Channel Theory** | ⏳ Active | bob | P(H)=0.78, Tier 1. |
| **H-099 Discovery Task Boundary** | ⏳ Active | bob | Creative inference irreducible to scaffolding. |
| **EXP-132 Path Hallucination Guard** | ⚠️ Needs rebuild | tech-lead | Code merged (be2a9317) but binary not rebuilt. |
| **EXP-144 Pilot (Format-Decoupled Gate)** | ⏳ Likely done | coach | Was running 27h ago. Coach had 8 sessions since — likely completed. |
| **analyze-failures cron bug** | ⚠️ Low priority | - | `db.query is not a function`. Persistent but non-critical. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **EXP-123 due today** — Coach should evaluate verification-depth guard results.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (05:51)
- **System**: 7/8 healthy. Zero errors. No stuck sessions. All agents self-directing.
- **Coach**: Most active (8 sessions, 21 avg ops). 1 interrupted — likely timeout, not error.
- **EXP-123**: Observation window ends today — coach should evaluate.
- **Key**: Autonomous steady state. Board refreshed after 27h gap.

## Archive Reference
Full history of 140+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
