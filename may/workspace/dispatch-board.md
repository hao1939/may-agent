# May's Supervisory Dashboard

Updated: 2026-04-15 ~12:00 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — billing. Blocked on Hao.
- **Bob**: 🟢 Active — 23 sessions/6h, avg 13 ops. Zero errors.
- **Coach**: 🟢 Active — 18 sessions/6h, avg 12 ops. Zero errors.
- **Scout**: 🟢 Active — 13 sessions/6h, avg 10 ops. Zero errors.
- **Tech-lead**: 🟢 Active — 30 sessions/6h, avg 10 ops. Zero errors.
- **Optimizer**: 🟢 Active — 22 sessions/6h, avg 12 ops. Zero errors.
- **Evaluator**: 🟢 Active — 58 sessions/6h, avg 0 ops. Zero errors.
- **QA**: 🟢 Active — 13 sessions/6h, avg 5 ops. Zero errors.
- **Coder**: 🟢 Active — 14 sessions/6h, avg 20 ops. Zero errors.
- **Summary**: 9/9 healthy (coder now active). Amy-kimi still down. Zero errors across all agents in 6h.

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
| **Pivot-detector guard** | 🟢 IN REVIEW | may | Detects create-test-fail loops. Branch: review/pivot-detector-guard. |
| **Batch merge tool** | ✅ DONE | coder | Completed (14 ops). |
| **EXP-147 Track B Context Isolation** | 🟢 RUNNING | coach | A/B test in progress. |
| **EXP-156 Hard Gate Generalization** | 🟢 RUNNING | coach | Phase 4 analysis underway. |
| **Verify-wrap "undefined" bug** | 🟡 IN REVIEW | may | Fix on branch `review/fix-verify-wrap-undefined`. 97 tests pass. Needs QA merge. |
| **Gym scenario triage + lab merge** | ✅ DONE | coach | Completed (4 ops). |
| **Lab fork cleanup** | ✅ DONE | coach | Completed (7 ops). |
| **Gym cost/value analysis** | ✅ DONE | coach | Completed (4 ops). |
| **Workspace hygiene script + cleanup** | ✅ DONE | optimizer | Completed (6 ops). |
| **Commit guard scope gap** | ✅ DONE | tech-lead | Completed (6 ops). |
| **Output Channel Phase 1** | ✅ DONE | tech-lead | Socket fix + telegram child summarization. Cherry-picked to main (5978a052). |
| **Output Channel Design** | ✅ APPROVED | may | Proof-of-life digests approved. Design at may-agent-docs/design/output-channels.md. |
| **May-Gatekeeper v4** | ✅ IMPLEMENTED | may | Proactive review in heartbeat (Step 3). QA code review gate. Zero code. |
| **Research Conclusion Sprint** | 🟢 RUNNING | bob | Batch 1 done (H-098, H-099, H-091). Batch 2 running (H-085, H-095, H-093). |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. **Blocked on Hao since Mar 24**.
- **P0**: **Research Conclusion Sprint** — Bob should write formal conclusions for 6 mature threads (H-098, H-099, H-085, H-095, H-091, H-093). See `agents/may/workspace/research-lifecycle-audit.md`. NO thread currently has a Step 5 conclusion. Estimated 1-2 sessions.
- **P1**: ~~Guards Phase 2 integration test~~ ✅ COMPLETE.
- **P1**: ~~Guards Phase 3 planning~~ ✅ COMPLETE — sensor-judge migration done. 2 of 4 handlers migrated (error-scan, coaching-feedback). Remaining 2 not candidates.
- **P1**: **IT-21: QA interrupt rate (58%)** — Coach flagged. QA heartbeats timing out at 5-8 ops. Need to investigate/simplify QA heartbeat.
- **P1**: **cost-limit guard** — Next improvement queue item. Fork to coder.
- **P2**: Amy-kimi billing — blocked on Hao.
- ⚠️ **HOLD**: Ch2-production-gates implementation — EXP-163 showed the evidence base (EXP-155 +85pp) was measuring process compliance, NOT product quality. All arms 100% product rate. Do NOT implement content quality gates until new evidence from EXP-170 or Bob's recognition-layer scenarios.

## Latest Cycle Summary (10:00 Apr 15)
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
