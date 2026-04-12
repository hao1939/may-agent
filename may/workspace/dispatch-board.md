# May's Supervisory Dashboard

Updated: 2026-04-12 ~07:53 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors (billing). Blocked on Hao.
- **Bob**: 🟢 Active — Processing EXP-147 Track A results. Track B design + EXP-146 results in progress.
- **Coach**: 🟢 Active — EXP-146 Phase 1 ran (blocked on infra). Convention regressions ongoing.
- **Scout**: 🟢 Active — Heartbeat cycle running.
- **Tech-lead**: 🟢 Active — Cron handler resolver COMPLETE. D-o-R fix WIP.
- **Optimizer**: 🟢 Active — Cycling normally.
- **Evaluator**: 🟢 Active — 440 evals/24h.
- **QA**: 🟢 Active.
- **Coder**: Available — no active sessions. Skills pruned to 3 (was 10).
- **Summary**: 7/8 healthy. Amy-kimi 429 (billing). All others cycling normally.

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
| **EXP-105 Few-Shot Production Impact** | ⏳ WAITING | coach | Zero coder/optimizer work sessions since deployment (Apr 9). Baselines captured. |
| **EXP-114a Tool Schema Guard Monitoring** | ⏳ INSUFFICIENT DATA | coach | 57 sessions, 0 activations. Need 280+. |
| **Web UI Agent Visualization Dashboard** | ⚠️ Branch stale | tech-lead | Source on main (`web.ts` 663 lines). Branch needs reconciliation. |
| **Finish-Guard Git Ops False Positive** | ⚠️ Dispatched | tech-lead | FM-3.1 guard blocked git merge 4×. |
| **Bob H-097 CCC Triad Hypothesis** | ⏳ IN PROGRESS | bob | P(H)=0.55. EXP-147 Track A Phase 1 done (0.92% wrong-consensus — P-120b moot). Track B pending. |
| **H-098 Attention Channel Theory** | 🆕 FILED | bob | P(H)=0.78, Tier 1. |
| **H-099 Discovery Task Boundary** | 🆕 FILED | bob | Creative inference irreducible to scaffolding. |
| **EXP-132 Path Hallucination Guard** | ⚠️ Needs rebuild | tech-lead | Code merged but binary not rebuilt. |
| **Convention Regressions** | ⚠️ IN PROGRESS | coach | QA: C1.1 44.4%, C1.4 71.1%. Optimizer: C1.1 78.1%, C1.3 82%. |
| **Deliver-or-Report Workflow Fix** | ⏳ IN PROGRESS | tech-lead | 41% done rate. Sensitivity fix in progress. |
| **EXP-145 Guard Dependency Escalation** | ✅ COMPLETE | coach | H-104 FALSIFIED (0.78→0.10). Fleet fire rate declined 25.1%→2.6%. |
| **EXP-146 Thinking-Token Analysis** | ⏳ Phase 1 ran | bob+coach | Coach ran Phase 1 (blocked on infra). Bob processing results + updating H-105. |
| **EXP-147 CCC Triad Validation** | ⏳ Track B DESIGNING | bob | Track A done (0.92% wrong-consensus, P-120b moot). Bob refining Track B design (Context Isolation). |
| **Cron Handler Resolver** | ✅ COMPLETE | tech-lead | All tests passing (31/31 cron-tool + 5/5 handler-resolver). Committed. |

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **Federation sync reliability** — Auto-commit data loss is recurring. Tech-lead redesigned but incidents continue.
- **P1**: **Generate implementation work** — System idle without features. Coder completely idle. Need Hao priorities.
- **P2**: Amy-kimi billing — blocked on Hao.

## Latest Cycle Summary (07:24)
- **System**: 7/8 healthy. All agents cycling normally. 440 evals/24h (73% coverage).
- **EXP-147 Track A Phase 1 COMPLETE**: Wrong-consensus rate 0.92% (CI: 0.73-1.11%). P-120b (calibration) moot — system already <1% disagreement. Skip Phase 2. Track B (Context Isolation) next.
- **EXP-145 COMPLETE**: H-104 FALSIFIED (P(H) 0.78→0.10). Fleet fire rate 25.1%→2.6%.
- **Coder Skill Pruning COMPLETE**: 10→3 skills, 70% reduction (43KB→~13KB).
- **Optimizer**: Bob research thread budget caps confirmed working (-62% tool calls). Session archaeology completed.
- **Tech-lead**: D-o-R sensitivity fix + cron handler resolver in progress.
- **Coach**: Convention regressions (QA C1.1/C1.4, Optimizer C1.1/C1.3) — targeted fixes deployed.
- **Improvement queue**: 4 ready items (skill sunset, archive rotation, H-104 impact review, evaluator tagging).

## Archive Reference
Full history of 140+ completed items archived to `dispatch-board-archive-apr12.md`.
Key milestones:
- **Gym graduation** (EXP-098 + Wave 2): All exit conditions met. Gym in maintenance mode.
- **Few-Shot Phase 1**: Built, tested, merged. Production deployment live for coder/optimizer.
- **104+ experiments**: Synthesized into KE-101 (5 Laws of Agent Improvement).
- **Dead code**: 4,779+ lines removed.
- **EXP-109 Production Study**: 19,062 evals → 6 archetypes. LANDMARK.
- **Channel Theory** (EXP-127/128/129/130/131): Only Ch2 (structural gates) works for judgment. Discovery tasks reject all channels.
