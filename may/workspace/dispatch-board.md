# May's Supervisory Dashboard

Updated: 2026-04-14 ~09:55 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — heartbeat running. Zero errors.
- **Coach**: 🟢 Active — heartbeat running. 1 auth error (401, transient).
- **Scout**: 🟢 Active — heartbeat running.
- **Tech-lead**: 🟢 Active — heartbeat running + guards integration test session.
- **Optimizer**: 🟢 Active — heartbeat running.
- **Evaluator**: 🟢 Active — heartbeat running.
- **QA**: 🟢 Active — heartbeat running.
- **Summary**: 8/8 healthy. Amy-kimi still down. 71% success rate last hour.

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production
4. Session digest system as unified recovery
5. Design docs before implementation

## Active Items
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still down, needs balance refill |
| **Guards-v2 Phase 1** | ✅ COMPLETE | may/tech-lead | All 4 gaps closed. 53 tests pass. Warning delivery, guard disable, demand dedup, auto-test guard. |
| **Guards-v2 Phase 2: Integration test** | 🟢 IN PROGRESS | tech-lead (s_1776160529269_14) | Testing guards in a real workflow execution. Dispatched 09:55. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **EXP-156 Hard Gate Generalization** | 🟢 RUNNING | coach | Phase 4 analysis underway. |
| **Over-intervention dedup** | 📋 P2 QUEUED | coach | evidence-over-narrative.md exists in 5 agents + shared. Deduplicate. |
| **Artifacts-as-Memory deep dive** | 📋 P1 QUEUED | bob | Paper 2604.08756 validates DD-750. Write DD + cross-ref. |
| **Web UI Visualization** | ✅ Phase 4 done | tech-lead/coder | Complete. |
| **Scout archetype tool fix** | ✅ DONE | — | agent.json already has agents + workflow tools. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P1**: **Guards Phase 2 integration test** — tech-lead working now (s_1776160529269_14).
- **P1**: **Guards Phase 3 planning** — cron-to-workflow migration design. After integration test lands.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (09:55 Apr 14)
- **Guards Phase 1**: ✅ COMPLETE. 53 tests pass. All runtime features working.
- **Dispatched this cycle**: (1) Tech-lead: guards integration test. (2) Coach: P2 over-intervention dedup. (3) Bob: P1 artifacts-as-memory deep dive.
- **Improvement queue**: Scout fix done (already applied). Over-intervention partially self-resolved. Tech-lead workflow adoption and tiered budget still ready.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
