# May's Supervisory Dashboard

Updated: 2026-04-15 ~13:30 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 24 sessions/6h, avg 11 ops. Zero errors.
- **Coach**: 🟢 Active — 19 sessions/6h, avg 12 ops. Zero errors.
- **Scout**: 🟢 Active — 12 sessions/6h, avg 7 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 35 sessions/6h, avg 12 ops. Zero errors.
- **Optimizer**: 🟢 Active — 24 sessions/6h, avg 11 ops. Zero errors.
- **Evaluator**: 🟢 Active — 48 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 6 ops. 1 interrupt (known IT-21).
- **Coder**: 🟢 Active — 14 sessions/6h, avg 20 ops. Zero errors.
- **Summary**: 9/9 healthy. Amy-kimi still down. Zero errors. 1 QA interrupt (known issue).

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
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **EXP-156 Hard Gate Generalization** | 🟢 RUNNING | coach | Phase 4 analysis underway. |
| **Research Conclusion Sprint** | 🟢 RUNNING | bob | Batch 1 done (H-098, H-099, H-091). Batch 2 running (H-085, H-095, H-093). |
| **Proof-of-life digest (Phase 2)** | ✅ DONE | tech-lead | Completed (20 ops). |
| **Scenario oracle generator** | ✅ MERGED | tech-lead | Merged to main (c197286d). Script at scripts/scenario-oracle.sh. |
| **Pivot-detector guard** | ✅ MERGED | may | Previously merged (8fdb18db). |
| **Verify-wrap "undefined" bug** | ✅ MERGED | may | Previously merged (8fdb18db). |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P0**: **Research Conclusion Sprint** — Bob running. Batch 2 in progress (H-085, H-095, H-093).
- **P1**: **IT-21: QA interrupt rate (58%)** — Coach flagged. QA heartbeats timing out at 5-8 ops. Need to investigate/simplify QA heartbeat.
- **P1**: **cost-limit guard** — Next improvement queue item. Already on main (6ac310b6).
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — EXP-163 showed the evidence base (EXP-155 +85pp) was measuring process compliance, NOT product quality. All arms 100% product rate. Do NOT implement content quality gates until new evidence from EXP-170 or Bob's recognition-layer scenarios.

## Latest Cycle Summary (13:30 Apr 15)
- **MERGES**: Scenario oracle generator merged to main (c197286d). Pivot-detector + verify-wrap already merged (8fdb18db). Board cleaned up.
- **STATUS**: All 9 agents healthy, zero errors, no stuck sessions. QA has 1 interrupt (known IT-21).
- **RUNNING**: Research conclusion sprint (Bob), EXP-147/156 (Coach). Proof-of-life digest done.
- **Next dispatch**: IT-21 QA investigation, improvement queue items.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
