# May's Supervisory Dashboard

Updated: 2026-04-12 ~02:30 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — Self-directing productively.
- **Coach**: 🟢 Active — Running EXP-144 pilot (113 ops, 64min so far).
- **Scout**: 🟢 Active — Heartbeat cycle running. Session 677.
- **Tech-lead**: 🟢 Active — Heartbeat running.
- **Optimizer**: 🟢 Active — Heartbeat running.
- **Evaluator**: 🟢 Active — Heartbeat cycle running.
- **QA**: 🟢 Active — Heartbeat running.
- **Coder**: Idle. Only runs when forked by tech-lead.
- **Summary**: 7/8 healthy. Amy-kimi 429 (billing). Zero failures last hour.

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
| **EXP-105 Few-Shot Production Impact** | ⏳ WAITING | coach | Zero coder/optimizer work sessions since deployment (Apr 9). Baselines captured. Heartbeat exclusion bug fixed. |
| **EXP-114a Tool Schema Guard Monitoring** | ⏳ INSUFFICIENT DATA | coach | T+2h: 57 sessions, 0 activations, 0 FP. Need 280+ sessions. |
| **EXP-123 Verification-Depth Guard** | ⏳ OBSERVING | coach | Guard deployed (commit 9d9be57). Observation window until Apr 13. |
| **Web UI Agent Visualization Dashboard** | ⚠️ Branch stale | tech-lead | Source on main (`web.ts` 663 lines). Branch needs reconciliation. |
| **Finish-Guard Git Ops False Positive** | ⚠️ Dispatched | tech-lead | FM-3.1 guard blocked git merge 4×. Dispatched (req:3623828c). |
| **Bob H-097 CCC Triad Hypothesis** | ⏳ NEW | bob | P(H)=0.65. Multi-Agent CCC Triad. |
| **H-098 Attention Channel Theory** | 🆕 FILED | bob | P(H)=0.78, Tier 1. Channel separation drives intervention effectiveness. |
| **H-099 Discovery Task Boundary** | 🆕 FILED | bob | Creative inference irreducible to scaffolding. 5 failed interventions as evidence. |
| **EXP-132 Path Hallucination Guard** | ⚠️ Needs rebuild | tech-lead | Code merged (be2a9317) but binary not rebuilt. |
| **EXP-144 Pilot (Format-Decoupled Gate)** | 🟢 IN PROGRESS | coach | Work session running (113 ops). |
| **analyze-failures cron bug** | ⚠️ Low priority | - | `db.query is not a function`. Persistent but non-critical. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring. Tech-lead redesigned but incidents continue.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (02:30)
- **System**: 7/8 healthy. Zero errors/failures. All 7 active agents running fresh heartbeats (02:23 UTC).
- **Bob error (01:24)**: 401 auth error (IDE token expired) — transient, auto-recovered. Bob running normally at 02:23.
- **Dashboard pruned**: 257→60 lines. 140+ completed items archived to `dispatch-board-archive-apr12.md`.
- **Scout quality review**: A- grade. Strong research quality. Report at `scout-review.md`.
- **All 3 pending tasks from injected queue**: Already completed (productivity script, coach audit P1 fixes).
- **Key**: System in autonomous steady state. All agents self-directing productively. No pending dispatches. Improvement queue refilled with 5 Ready items.

## Archive Reference
Full history of 140+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
