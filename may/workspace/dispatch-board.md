# May's Supervisory Dashboard

Updated: 2026-04-15 ~14:00 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 25 sessions/6h, avg 12 ops. Zero errors.
- **Coach**: 🟢 Active — 20 sessions/6h, avg 11 ops. Zero errors.
- **Scout**: 🟢 Active — 12 sessions/6h, avg 7 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 37 sessions/6h, avg 16 ops. Zero errors.
- **Optimizer**: 🟢 Active — 24 sessions/6h, avg 10 ops. Zero errors.
- **Evaluator**: 🟢 Active — 50 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 6 ops. (IT-21 known).
- **Coder**: 🟢 Active — 15 sessions/6h, avg 20 ops. Zero errors.
- **Summary**: 9/9 healthy. Amy-kimi still down. Zero errors across the board.

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
| **Metric System Phase 3 — Adoption** | ⏳ BLOCKED | may/tech-lead | Phase 1+2 complete. Phase 3 blocked on process restart for new handlers (heartbeat-context metrics injection, proof-of-life metrics). |
| **Wire gym-batch.sh into coach growth-cycle** | 🟡 Ready | tech-lead | Top improvement queue item. Small scope. |
| **Tech-lead post-dispatch finish guard** | 🟡 Ready | may | Heartbeat edit to prevent 100+ op heartbeats. |
| **QA heartbeat simplification (IT-21)** | 🟡 Ready | tech-lead | QA interrupt rate 67%. Needs investigation + simplification. |

## Completed This Cycle
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| **Metric System Phase 2** | ✅ DONE | tech-lead | system_status agent param, proof-of-life metrics, heartbeat-context injection (s_1776269084528_9, 32 ops) |
| **EXP-163 Results Processing** | ✅ DONE | bob | KE-129 reinterpreted, H-161 updated, KE-184 written (ceiling effect methodology). |
| **Research Conclusion Sprint** | ✅ DONE | bob | All 6 threads concluded (Batch 1: H-098/099/091, Batch 2: H-085/095/093). Synthesis written. |
| **EXP-147 Track B Context Isolation** | ✅ DONE | coach | All experiments COMPLETE or CANCELLED per coach. |
| **EXP-156 Hard Gate Generalization** | ✅ DONE | coach | All experiments COMPLETE or CANCELLED per coach. |
| **Proof-of-life digest (Phase 2)** | ✅ DONE | tech-lead | Completed (20 ops). |
| **Scenario oracle generator** | ✅ MERGED | tech-lead | Merged to main (c197286d). |
| **Pivot-detector guard** | ✅ MERGED | may | Previously merged (8fdb18db). |
| **Verify-wrap "undefined" bug** | ✅ MERGED | may | Previously merged (8fdb18db). |
| **Unified Metric System Design** | ✅ DONE | bob | All 5 brainstorm responses synthesized. Approved by Hao. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P0**: **Unified Metric System Design** — Bob running. Output → agents/bob/workspace/unified-metric-system-design.md for Hao review.
- **P1**: **IT-21: QA interrupt rate (58%)** — Coach flagged. QA heartbeats timing out at 5-8 ops. Need to investigate/simplify QA heartbeat.
- **P1**: **cost-limit guard** — Next improvement queue item. Already on main (6ac310b6).
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — EXP-163 showed the evidence base (EXP-155 +85pp) was measuring process compliance, NOT product quality. All arms 100% product rate. Do NOT implement content quality gates until new evidence from EXP-170 or Bob's recognition-layer scenarios.

## Latest Cycle Summary (14:30 Apr 15)
- **MILESTONE**: All 5 metric brainstorm responses received (Bob 89 lines, tech-lead 73, optimizer 81, coach 74, scout 91). Synthesis session forked to Bob.
- **RUNNING**: Bob synthesizing unified metric proposal + EXP-163 results processing.
- **STATUS**: 9/9 agents healthy. Zero errors. No stuck sessions. 1 tech-lead interrupt (abort, not error).

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
