# May's Supervisory Dashboard

Updated: 2026-04-15 ~08:30 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 10 sessions/6h, avg 13 ops. Zero errors.
- **Coach**: 🟢 Active — 10 sessions/6h, avg 13 ops. Zero errors.
- **Scout**: 🟢 Active — 8 sessions/6h, avg 12 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 10 sessions/6h, avg 8 ops. Zero errors.
- **Optimizer**: 🟢 Active — 12 sessions/6h, avg 12 ops. Zero errors.
- **Evaluator**: 🟢 Active — 24 sessions/6h, avg 1 op. Zero errors.
- **QA**: 🟢 Active — 8 sessions/6h, avg 4 ops. Zero errors.
- **Summary**: 8/8 healthy. Amy-kimi still down. Zero errors across all agents in 6h.

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
| **Guards-v2 Phase 2: Integration test** | ✅ COMPLETE | tech-lead | Done (23 ops). Guards tested in real workflow execution. |
| **Pivot-detector guard** | 🟢 IN REVIEW | may | Detects create-test-fail loops (bob 280ops, coach 118ops). Warns at 3, intervenes at 5. 7 tests. Branch: review/pivot-detector-guard. |
| **Batch merge tool** | 📋 P1 QUEUED | tech-lead | Script to automate review branch merges. Saves ~40 ops/session. |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **EXP-156 Hard Gate Generalization** | 🟢 RUNNING | coach | Phase 4 analysis underway. |
| **Over-intervention dedup** | ✅ DONE | coach | Removed 5 redundant evidence-over-narrative copies. Canonical at shared/knowledge/fewshot-examples/. Commit: 2cd4dfd7. |
| **Artifacts-as-Memory deep dive** | 📋 P1 QUEUED | bob | Paper 2604.08756 validates DD-750. Write DD + cross-ref. |
| **Verify-wrap "undefined" bug** | 🟡 IN REVIEW | may | Fix on branch `review/fix-verify-wrap-undefined`. 97 tests pass. Needs QA merge. |
| **Gym scenario triage + lab merge** | 🟢 DISPATCHED | bob | Design doc for 295→30-50 scenarios + lab→gym merge. Req b0d82f98. |
| **Lab fork cleanup** | 🟢 DISPATCHED | coach | Audit 55 .lab/ forks, delete stale. Req c724e8ee. |
| **Gym cost/value analysis** | 🟢 DISPATCHED | optimizer | 952 sessions/week cost analysis. Req 7e06acd1. |
| **Web UI Visualization** | ✅ Phase 4 done | tech-lead/coder | Complete. |
| **Scout archetype tool fix** | ✅ DONE | — | agent.json already has agents + workflow tools. |
| **Workspace hygiene script + cleanup** | 🟢 DISPATCHED | tech-lead | Prune stale archives (bob 5.8MB, coach 2.3MB, optimizer 2.0MB). Req de6620e5. |
| **Commit guard scope gap** | 🟢 DISPATCHED | tech-lead | Guard only checks agents/<name>/, misses src/ and shared/. Req ebefef5a. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P1**: ~~Guards Phase 2 integration test~~ ✅ COMPLETE.
- **P1**: ~~Guards Phase 3 planning~~ ✅ COMPLETE — sensor-judge migration done. 2 of 4 handlers migrated (error-scan, coaching-feedback). Remaining 2 not candidates.
- **P1**: **IT-21: QA interrupt rate (58%)** — Coach flagged. QA heartbeats timing out at 5-8 ops. Need to investigate/simplify QA heartbeat.
- **P1**: **cost-limit guard** — Next improvement queue item. Fork to coder.
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — EXP-163 showed the evidence base (EXP-155 +85pp) was measuring process compliance, NOT product quality. All arms 100% product rate. Do NOT implement content quality gates until new evidence from EXP-170 or Bob's recognition-layer scenarios.

## Latest Cycle Summary (12:38 Apr 14)
- **BUG FIX**: verify-wrap 50% error rate — string "undefined" in ctx.agent. Fix on review branch `review/fix-verify-wrap-undefined` (commit fa5d279d). Two changes: ctx.agent rejects string "undefined", runAgent validation catches "undefined"/"unknown". 97 tests pass.
- **GYM/LAB REVIEW**: Dispatched 3 workstreams per Hao's review:
  - Bob → gym scenario triage criteria + lab→gym merge spec (req b0d82f98)
  - Coach → audit .lab/ forks, delete stale ones (req c724e8ee)
  - Optimizer → gym cost/value analysis, 952 sessions/week (req 7e06acd1)
- Tech-lead items (gym.db + CI smoke runner) deferred until Bob's design lands.
- EXP-163 HOLD on ch2-production-gates still in effect.
- IT-21 (QA interrupt rate) dispatched to optimizer. IT-22 (KE-129 reinterpretation) dispatched to Bob.
- Coach flagged IT-20 (new H-161 test), IT-21 (QA interrupts), IT-22 (reinterpret KE-129).
- **Pending merge**: pivot-detector guard branch `review/pivot-detector-guard` needs merge session.
- **Next dispatch**: cost-limit guard (fork to coder), IT-21 QA investigation (fork to tech-lead/optimizer).

## Archive Reference
Full history of 148+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
