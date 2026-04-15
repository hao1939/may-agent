# May's Supervisory Dashboard

Updated: 2026-04-15 ~15:00 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 30 sessions/6h, avg 14 ops. Zero errors.
- **Coach**: 🟢 Active — 25 sessions/6h, avg 15 ops. Zero errors.
- **Scout**: 🟢 Active — 14 sessions/6h, avg 6 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 35 sessions/6h, avg 18 ops. Zero errors.
- **Optimizer**: 🟢 Active — 26 sessions/6h, avg 10 ops. Zero errors.
- **Evaluator**: 🟢 Active — 49 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 6 ops. (IT-21 known).
- **Coder**: 🟢 Active — 11 sessions/6h, avg 20 ops. Zero errors.
- **Summary**: 9/9 healthy. Amy-kimi still down. 1 bob interrupt (abort, not real error). No stuck sessions.

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
| **Unified Metric System Design** | ✅ APPROVED | may | Hao approved. Phase 1 implementation dispatched to tech-lead. Project: `agents/shared/projects/metric-system.md`. |
| **Metric System Brainstorm** | ✅ DONE | bob | All 5 responses synthesized → `unified-metric-system-proposal.md`. Approved by Hao. |
| **Metric System Phase 1** | 🟢 RUNNING | tech-lead | Schema + snapshot handler + seed metrics. Forked ~14:55 UTC. |
| **KE-180/182 Hard Gate Rules Deployment** | 🟢 RUNNING | coach | Deploy hard gate design rules to production artifact. Forked ~15:00 UTC. |
| **TL Post-Dispatch Finish Guard** | ✅ DONE | may | Added "finish within 3 ops after fork" to tech-lead heartbeat Step 3. |
| **EXP-163 Results Processing** | ✅ DONE | bob | KE-129 reinterpreted, H-161 updated, KE-184 written (ceiling effect methodology). |
| **Research Conclusion Sprint** | ✅ DONE | bob | All 6 threads concluded (Batch 1: H-098/099/091, Batch 2: H-085/095/093). Synthesis written. |
| **EXP-147 Track B Context Isolation** | ✅ DONE | coach | All experiments COMPLETE or CANCELLED per coach. |
| **EXP-156 Hard Gate Generalization** | ✅ DONE | coach | All experiments COMPLETE or CANCELLED per coach. |
| **Proof-of-life digest (Phase 2)** | ✅ DONE | tech-lead | Completed (20 ops). |
| **Scenario oracle generator** | ✅ MERGED | tech-lead | Merged to main (c197286d). |
| **Pivot-detector guard** | ✅ MERGED | may | Previously merged (8fdb18db). |
| **Verify-wrap "undefined" bug** | ✅ MERGED | may | Previously merged (8fdb18db). |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P0**: **Unified Metric System Phase 1** — Tech-lead implementing. Schema + snapshot handler + seed metrics. Track in `agents/shared/projects/metric-system.md`.
- **P1**: **IT-21: QA interrupt rate (58%)** — Coach flagged. QA heartbeats timing out at 5-8 ops. Need to investigate/simplify QA heartbeat.
- **P1**: **cost-limit guard** — Next improvement queue item. Already on main (6ac310b6).
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — EXP-163 showed the evidence base (EXP-155 +85pp) was measuring process compliance, NOT product quality. All arms 100% product rate. Do NOT implement content quality gates until new evidence from EXP-170 or Bob's recognition-layer scenarios.

## Latest Cycle Summary (15:00 Apr 15)
- **Metric System Phase 1**: Still running with tech-lead. No errors.
- **DISPATCHED**: KE-180/182 hard gate design rules → coach (knowledge APPLICATION priority).
- **DONE**: Tech-lead post-dispatch finish guard — added to heartbeat Step 3.
- **STATUS**: 9/9 agents healthy. No errors. No stuck sessions. 5 pending requests all completed or in-progress.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
