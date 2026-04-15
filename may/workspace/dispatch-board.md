# May's Supervisory Dashboard

Updated: 2026-04-15 ~17:30 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 31 sessions/6h, avg 18 ops. Zero errors.
- **Coach**: 🟢 Active — 25 sessions/6h, avg 15 ops. Zero errors.
- **Scout**: 🟢 Active — 15 sessions/6h, avg 8 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 31 sessions/6h, avg 20 ops. Zero errors.
- **Optimizer**: 🟢 Active — 25 sessions/6h, avg 12 ops. Zero errors.
- **Evaluator**: 🟢 Active — 39 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 7 ops. (IT-21 known).
- **Coder**: 🟢 Active — 6 sessions/6h, avg 20 ops. Zero errors.
- **Summary**: 9/9 healthy. Amy-kimi still down. Zero errors across the board.

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. **Productive output over cost** — optimizer reframed: "spend better, not less" (Hao directive ~17:04 Apr 15)
3. Evidence-first rule for all changes
4. **Knowledge APPLICATION** — deploy verified KEs to production
5. Session digest system as unified recovery
6. Design docs before implementation

## Active Items
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still down, needs balance refill |
| **Metric System Phase 3 — Adoption** | ⏳ Active | multiple | Phase 3 dispatched: research_log adoption (bob+scout), quality investigation (coach), threshold fix (tech-lead ✅ DONE). |
| **Heartbeat System Review** | ✅ Done | optimizer | Full analysis delivered: `agents/optimizer/workspace/finding-heartbeat-efficiency-analysis-0415.md`. 47% of ops on heartbeats, ~1280 ops/day saveable. Hao redirected: productive output > cost. |
| **Model Diversity Review** | ⏳ Active | bob | Design review: which agent on which model? (req:c56a6ae4) |
| **Wire gym-batch.sh into coach growth-cycle** | ⏳ Dispatched | tech-lead | Forked (req:a3787a7c). |
| **Human Input DB Logging** | ⏳ Dispatched | tech-lead | Fork s_1776274344039_67 — INSERT human messages to requests table (req:99d045dd). |
| **Optimizer mission reframe** | ✅ Done | may (Hao's session) | "Productive output over cost" — focus areas rewritten. Committed. |
| **Tech-lead post-dispatch finish guard** | 🟡 Ready | may | Heartbeat edit to prevent 100+ op heartbeats. |
| **QA heartbeat simplification (IT-21)** | 🟡 Ready | tech-lead | QA interrupt rate 67%. Needs investigation + simplification. |
| ⚠️ **Hao task truncated** | ❓ Need info | Hao | req:7a936dcb was truncated at 500 chars. Only issue #1 (threshold inversion) visible+dispatched. May have more issues. |
| ⚠️ **Heartbeat.md conflict** | 🟡 Review | Hao | Hao's session re-added inline queries to may/heartbeat.md after tech-lead slimmed them. heartbeat-context handler already injects this data. Needs Hao decision: keep inline or trust pre-computed? |

## Completed This Cycle
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| **Error-rate threshold fix** | ✅ DONE | tech-lead | Inverted threshold logic fixed (11 ops, req:7eae2c5e). |
| **Metric System Phase 2** | ✅ DONE | tech-lead | system_status agent param, proof-of-life metrics, heartbeat-context injection (s_1776269084528_9, 32 ops) |
| **EXP-163 Results Processing** | ✅ DONE | bob | KE-129 reinterpreted, H-161 updated, KE-184 written (ceiling effect methodology). |
| **Research Conclusion Sprint** | ✅ DONE | bob | All 6 threads concluded (Batch 1: H-098/099/091, Batch 2: H-085/095/093). Synthesis written. |
| **Unified Metric System Design** | ✅ DONE | bob | All 5 brainstorm responses synthesized. Approved by Hao. |

## Next Actions
- **P0**: **Fix compose-guards.ts** — finish(success) stays guarded, finish(blocked/failure) passes. Forked to tech-lead (s_1776278050544_32).
- **P0**: **Guard Escalation Design v2** — Update to Hao's chain (Agent→owner→May→Hao). Forked to bob (s_1776277963821_30).
- **P0**: **Evaluator quality=0.00 (IT-28)** — Root cause investigation. Forked to tech-lead (s_1776277963790_29).
- **P1**: **Human Input DB Logging** — Dispatched to tech-lead. Awaiting completion.
- **P1**: **Wire gym-batch.sh** — Dispatched to tech-lead.
- **P1**: **QA heartbeat simplification (IT-21)** — 67% interrupt rate. Ready to dispatch.
- **P1**: **Tech-lead post-dispatch finish guard** — Prevent 100+ op heartbeats. Small heartbeat edit.
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — Evidence base was measuring compliance not quality. Hold for EXP-170.

## Latest Cycle Summary (18:30 Apr 15)
- **RECEIVED**: 2 Hao directives (req:7f8b7fc2, req:6179b3fa) — Guard revert + proper escalation chain. 2 coach P0s (IT-28 evaluator quality bug).
- **DISPATCHED**: compose-guards fix → tech-lead. Escalation design v2 → bob. IT-28 investigation → tech-lead.
- **COMPLETED**: Guard warn-only revert (commit cf797144). Cost-limit removal done earlier.
- **CANCELLED**: Stuck coach EXP-165 session (38min).
- **KEY FINDING**: compose-guards.ts still had blanket finish() bypass — Hao wants finish(success) guarded, only finish(blocked/failure) through.
- **STATUS**: 9/9 agents active. Zero errors. 3 P0 tasks in progress.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
