# May's Supervisory Dashboard

Updated: 2026-04-15 ~20:00 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 35 sessions/6h, avg 21 ops. Zero errors.
- **Coach**: 🟢 Active — 27 sessions/6h, avg 20 ops. Zero errors.
- **Scout**: 🟢 Active — 16 sessions/6h, avg 12 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 37 sessions/6h, avg 23 ops. Zero errors.
- **Optimizer**: 🟢 Active — 25 sessions/6h, avg 13 ops. Zero errors.
- **Evaluator**: 🟢 Active — 48 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 12 sessions/6h, avg 8 ops. Zero errors.
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
| **Model Diversity Review** | ⏳ Active | bob | Design review: which agent on which model? (req:c56a6ae4) |
| **Fix compose-guards.ts (RETRY)** | ✅ DONE+MERGED | tech-lead | Merged to main (2705e8ce). finish(blocked/failure) bypasses guards, finish(success) blocked by quality gate. |
| **Gatekeeper Review Gate design** | 📋 Review | bob+tech-lead | Design at `agents/shared/may-agent-docs/design/review-gate.md`. Bob reviewed. Tech-lead answered open Qs (pure fn confirmed, review quality addressed). Awaiting Hao approval. |
| **Heartbeat commit instruction fix** | ✅ DONE | may | Fixed Step 7 of heartbeat.md — was telling me NOT to commit (stale 10min auto-commit reference). Now says commit first, auto-commit is 2h safety net. |
| ⚠️ **Hao task truncated** | ❓ Need info | Hao | req:7a936dcb was truncated at 500 chars. Only issue #1 (threshold inversion) visible+dispatched. May have more issues. |

## Completed This Cycle
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| **Evaluator quality=0.00 (IT-28)** | ✅ DONE | tech-lead | 3 fixes: metric query excludes skippedByJs, eval-sync stops zero-quality rows, getAgentScoreSummary filters skipped. Branch: review/fix-evaluator-quality (108 ops). |
| **Guard Escalation Design v2** | ✅ DONE | bob | Updated to Hao's chain (Agent→owner→May→Hao). Design at `agents/shared/may-agent-docs/design/guard-escalation.md`. |
| **QA IT-21 Root Cause** | ✅ DONE | tech-lead | NOT a QA heartbeat problem — system-wide external session abortion. QA heartbeat is lean (6-10 ops, 49 lines). May have self-resolved. |
| **Error-rate threshold fix** | ✅ DONE | tech-lead | Inverted threshold logic fixed (11 ops, req:7eae2c5e). |
| **Metric System Phase 2** | ✅ DONE | tech-lead | system_status agent param, proof-of-life metrics, heartbeat-context injection (s_1776269084528_9, 32 ops) |
| **EXP-163 Results Processing** | ✅ DONE | bob | KE-129 reinterpreted, H-161 updated, KE-184 written (ceiling effect methodology). |
| **Research Conclusion Sprint** | ✅ DONE | bob | All 6 threads concluded (Batch 1: H-098/099/091, Batch 2: H-085/095/093). Synthesis written. |
| **Unified Metric System Design** | ✅ DONE | bob | All 5 brainstorm responses synthesized. Approved by Hao. |
| **Heartbeat System Review** | ✅ Done | optimizer | 47% of ops on heartbeats, ~1280 ops/day saveable. Hao redirected: productive output > cost. |
| **Optimizer mission reframe** | ✅ Done | may | "Productive output over cost" — focus areas rewritten. |
| **Human Input DB Logging** | ✅ Done | tech-lead | Merged to main (799b223f). |
| **Wire gym-batch.sh** | ✅ Done | tech-lead | Closed (req:a3787a7c). |

## Next Actions
- **P0**: ~~Merge compose-guards.ts fix~~ — ✅ DONE (2705e8ce on main).
- **P1**: **Gatekeeper Review Gate** — Design complete, Bob+tech-lead reviewed. Needs Hao approval → then dispatch to tech-lead for implementation.
- **P1**: **QA heartbeat simplification (IT-21)** — Tech-lead found root cause is system-wide abort, not QA heartbeat. May have self-resolved. Monitor.
- **P1**: **Common-sense #23 auto-commit bypass** — Heartbeat.md fixed (step 7). Broader enforcement (guard that rejects finish() with uncommitted changes) still needs tech-lead work.
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — Hold for EXP-170.

## Latest Cycle Summary (20:00 Apr 15)
- **FIXED**: Heartbeat.md Step 7 — removed stale "do NOT commit" instruction, replaced with "commit first" per C13 convention. Auto-commit is 2h safety net, not substitute.
- **CANCELLED**: Bob stuck session (s_1776279045013_37, >70min, 12 ops). Will restart on next heartbeat.
- **VERIFIED**: compose-guards.ts already merged to main (2705e8ce). KE-180/KE-182 already deployed (62ece090).
- **STEADY**: 9/9 agents active. Zero errors. Evaluator avg 0 ops = correct (JS handler, no LLM).
- **WAITING**: Gatekeeper Review Gate needs Hao approval. Hao task truncation (req:7a936dcb) still unresolved.

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
