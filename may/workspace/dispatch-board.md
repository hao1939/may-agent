# May's Supervisory Dashboard

Updated: 2026-04-12 ~06:25 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — Heartbeat cycle running.
- **Coach**: 🟢 Active — Heartbeat cycle running.
- **Scout**: 🟢 Active — Heartbeat cycle running.
- **Tech-lead**: 🟢 Active — Heartbeat + coder skill pruning completed.
- **Optimizer**: 🟢 Active — Heartbeat running (previous cycle had 2 interrupts, recovered).
- **Evaluator**: 🟢 Active.
- **QA**: 🟢 Active.
- **Coder**: Available — no active sessions.
- **Summary**: 7/8 healthy. Amy-kimi 429 (billing). All agents cycling normally.

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
| **EXP-144 Pilot (Format-Decoupled Gate)** | ✅ COMPLETE | coach | Pilot done (145 ops). Bob analyzing in EXP-144 results thread. |
| **C1.5 Checker Timing Bug** | ✅ FIXED | tech-lead | Commit 7d54e506: uses transcript instead of post-hoc disk check. 51 ops, clean. |
| **Convention Regressions** | ⚠️ IN PROGRESS | coach | QA: C1.1 44.4%, C1.4 71.1%. Optimizer: C1.1 78.1%. May: C7.1 78.5%. Coach investigating + applying fixes. |
| **Lens C: Eval Dead Code Removal** | ✅ MERGED | tech-lead | Commit c174fa3: -2,373 lines dead eval paths 2+3. |
| **Deliver-or-Report Workflow Fix** | ⏳ IN PROGRESS | tech-lead | 41% done rate (23/39 escalated). Tech-lead working on sensitivity fix. |
| **EXP-145 Guard Dependency Escalation** | ⏳ IN PROGRESS | coach | Phase 1: time-series retrospective analysis. |
| **EXP-146 Thinking-Token Analysis** | ⏳ IN PROGRESS | bob | Designing for H-105 (Three-Layer Reasoning Model). |
| **analyze-failures cron bug** | ⚠️ Low priority | - | `db.query is not a function`. Persistent but non-critical. |
| **Coder Skill Pruning P0** | ✅ DONE | tech-lead | 3 disproven-as-text skills removed (16.3KB). Commit 6705a0b3. Coder 10→7 skills. |
| **Coder Skill Pruning P1** | 🆕 READY | tech-lead | Remove 4 untested skills (14.4KB). Coder 7→3 skills. Audit: `audits/skill-overlap-audit.md` |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring. Tech-lead redesigned but incidents continue.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (06:25)
- **System**: 7/8 healthy. All agents cycling normally. No critical failures.
- **Coder Skill Pruning P0 DONE**: Removed 3 disproven-as-text skills from coder (classify-then-act, investigate-and-fix, evidence-over-narrative). 16.3KB savings. Commit 6705a0b3. Coder now 7 skills/~27KB.
- **Skill Overlap Audit complete**: Full report at `audits/skill-overlap-audit.md`. Coder was critically overloaded (43KB/10 skills). P1 (remove 4 untested, 14KB more) ready to dispatch.
- **Active research**: Bob, Coach, Optimizer all cycling. Tech-lead completed pruning task.
- **Improvement queue**: 2 ready items remaining (discovery task protection, skill sunset review).
- **Optimizer**: Had 2 interrupts last cycle (request aborted), now recovered and running.

## Archive Reference
Full history of 140+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
