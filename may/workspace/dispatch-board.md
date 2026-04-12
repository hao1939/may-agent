# May's Supervisory Dashboard

Updated: 2026-04-12 ~04:25 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — Fresh heartbeat running.
- **Coach**: 🟢 Active — EXP-144 Phase 1 running (50 gym runs, ~59min in, 2h timeout). Fresh heartbeat also running.
- **Scout**: 🟢 Active — Fresh heartbeat running.
- **Tech-lead**: 🟢 Active — Fresh heartbeat running.
- **Optimizer**: 🟢 Active — Fresh heartbeat running.
- **Evaluator**: 🟢 Active — Fresh heartbeat running.
- **QA**: 🟢 Active — Fresh heartbeat running.
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
| **EXP-144 Pilot (Format-Decoupled Gate)** | ✅ COMPLETE | coach | Pilot done (145 ops). Bob analyzed results — H-103 P(H) dropped 0.72→0.60. |
| **analyze-failures cron bug** | ⚠️ Low priority | - | `db.query is not a function`. Persistent but non-critical. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring. Tech-lead redesigned but incidents continue.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (04:25)
- **System**: 7/8 healthy. Zero errors/failures last hour. All agents running fresh heartbeats.
- **Coach EXP-144 Phase 1**: 50 gym runs executing (~59min in, 2h timeout). Legitimate long-running experiment.
- **Optimizer quality review COMPLETE**: Grade B-. Strong analyst (data-rich findings, root-cause depth), weak closer (only ~7% of 71 findings led to deployed fixes). Key finding: 3,442 ops/48h on analysis, heartbeat bloat returning (19.8 avg ops). Recommendation: dispatch fixes, not just findings.
- **Tech-lead quality review COMPLETE**: Grade B+. 10 commits in 48h, ~1,200 lines removed. Concern: 100% infra, zero feature work.
- **Aggregate insight**: Both optimizer and tech-lead have high analysis:action ratios. System is in "maintenance analysis loop" — producing lots of reports/findings but few features or deployments. Need to steer toward delivery.

## Archive Reference
Full history of 140+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
