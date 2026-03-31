# Focus Tasks

**Status: Active**
**Owner: Bob**

This file tracks the immediate, high-leverage tasks that the team is focusing on.
It bridges the gap between the high-level `roadmap.md` and the daily task queue (request DB).

> Full history archived at `agents/bob/workspace/archive/focus-tasks-2026-03-30-snapshot.md`

---

## Active Focus

### Agent Evolution System (CI/CD for Prompts)
- **Problem**: Improvements are ad-hoc, untracked, and prone to regression. No systematic way to measure "is the agent better?".
- **Fix**: "Gym is CI" workflow. Coach drives behavior, Optimizer drives efficiency. All changes gated by baselines.
- **Status**: **[ACTIVE — At Prompting Ceiling]** (2026-03-30).
- **Owner**: Bob (Architecture), Coach/Optimizer (Execution).

#### Current State
- **120 gym scenarios** deployed (was 111 — Coach creating new variants). **80 tested** via gym_runs (40 untested, mostly new workflow variants + new Coach scenarios).
- **77 PASS, 30 FAIL (27.8% failure rate)** across original sweep of 108. New scenarios not yet baselined.
- **3 skills promoted to production**: verify-after-edit v1 (coder), and 2 others.
- **Key insight**: Prompting has reached its ceiling for most failure categories. Remaining gaps require runtime enforcement or model improvements.
- **Next action**: Run gym sweep on the 40 new/untested scenarios to establish baselines.

#### Failure Categories (30 failing scenarios)
| Category | Count | Status | Details |
|----------|-------|--------|---------|
| Judgment-class | 5 | **ACCEPTED** (model limitation) | escalation, ambiguous-spec, sycophancy, does-not-claim-success |
| Verification | 3 | **v1 DEPLOYED** (60% pass, 2x baseline) | verify-after-edit skill promoted. 40% gap needs runtime fix |
| Materialization | 2 | **CEILING at 7/9** | 4 experiments, prompting exhausted |
| Regression-awareness | 2 | **DEPRIORITIZED** | EXP-216 designed but Coach delegation unreliable |
| Search/Process | 3 | Untriaged | search-strategy-escalation, stale-approach, spec-adherence |
| Dependencies | 1 | Untriaged | silent-dependency |
| Evidence/Proof | 3 | Near-ceiling | context-proof-build (4/6), config (6/7), build-activation (8/9) |
| Contradiction | 1 | Untriaged | verification-contradiction-workflow |
| Near-ceiling (gap=1) | 10 | **LOW priority** | Various, gap of 1 run each |

#### Key Decisions
- **Guards policy** (2026-03-29): Guards ONLY for permanent/universal/mechanical checks. Judgment issues → context.md or workflow. See `agents/shared/may-agent-docs/design/code-vs-data-decisions.md`.
- **Negative examples anti-pattern**: ❌ WRONG examples in skill files cause regression. Gentle positive examples only.
- **Rule of Two**: If 2 iterations of same approach yield same result → stop, change approach.
- **does-not-claim-success**: Model always calls `finish(success)` even when reporting failures. Confirmed untreatable by prompting (EXP-215, C1.8 rule). Runtime-only fix.

#### Convention Check Status (2026-03-31 13:10)
- **SYSTEM-WIDE PASS RATE: 97.9%** (94/96 checks, last 3h). Above 95% target ✅
- Post-fix per-convention rates (N=8 sessions each):
  - **100%**: C1.1, C1.3, C1.4, C1.5, C1.7, C12.1, C2.1, C3.2, C3.3, C7.1 (10 conventions perfect)
  - **87.5%**: C6.1 (1 real: bob high tool count, threshold=80)
  - **87.5%**: C8.2 (1 real: amy-kimi Kimi model malformed JSON in finish())
- **Remaining gaps** are model-level (amy-kimi/Kimi) and behavioral (bob tool count), not infra bugs.
- **Module cache**: PERMANENTLY RESOLVED. Hot-reload working.
- **Interrupted session fix**: Deployed 2026-03-31 09:50. C1.4 improved 77.8%→100%, C8.2 improved 72.2%→87.5%.
- **Next**: Convention check system is stable. 44 untested gym scenarios need baseline sweep.

### Opus Prompt Caching (Cost Critical)
- **Problem**: Opus agents (Tech-Lead, Coach, May) have 0% cache hit rate due to LiteLLM stripping headers. Wasting $36-63/day.
- **Fix**: Bypass LiteLLM for Anthropic or update LiteLLM config.
- **Status**: **[ESCALATED]** (2026-03-24). Sent Brief to Hao via May (`brief-human-prompt-caching.md`). Blocked on Hao.
- **Owner**: Hao (Execution).

---

## Recently Completed (Last 7 Days)

| Task | Status | Date | Notes |
|------|--------|------|-------|
| C12.1/C1.3/C2.1 Calibration | DEPLOYED | 2026-03-30 | Convention check precision fixes in handler |
| Full Gym Sweep (3 parts) | COMPLETED | 2026-03-29 | 108/111 tested, 77 PASS, 30 FAIL |
| EXP-213/214 (Verify-Edit) | v1 PROMOTED | 2026-03-29 | 2x improvement (30%→60%). v2 rejected (regression) |
| EXP-215 (Prereq Detection) | CONCLUDED | 2026-03-29 | does-not-claim-success is model-level. Accepted |
| EXP-211/212 (Materialization) | CEILING | 2026-03-28 | 7/9 ceiling after 4 experiments |
| Path Hallucination Guard | REVERTED | 2026-03-29 | /home/hao mounted. Replaced by context.md facts |
| Gate 3/3b (Contradiction) | REVERTED | 2026-03-29 | Per Hao: guards wrong mechanism for judgment |
| Fork Injection Fix (P0) | FIXED | 2026-03-27 | Commit `2f1ab59`. Skills load into system prompt |

---

## Archive (Older Than 7 Days)

<details>
<summary>Click to expand full archive (items completed before 2026-03-23)</summary>

### Completed Infrastructure (2026-03-20)
- Context Awareness (CS 6.1 & 4.5) — `scripts/sync-tools-md.ts` verified
- Environment & Adversarial Hardening (P13/P108) — Confirmed in 10 agent SOULs
- Sycophancy Defense (P192) — Evaluator criteria updated with `[INVALID_RECEIPT]`
- Order Persistence (P209) — `src/lib/orders.ts` verified
- Ops Gate & Experience Replay (P61/P114) — `src/lib/ops-gate.ts` verified
- Reflect System (P110) — `agents/may/handlers/reflect.ts` created
- Explicit Acks Monitor (P82) — Resolved via write+send convention

### Completed Safety & Evolution (2026-03-12 to 2026-03-14)
- Self-Evolution Bifurcation — P53 formalized (Reasoning=Immutable, Capability=Mutable)
- P53 Zombie Code Flush — Security patched, quote-splitting blocked
- Reasoning Evolution Compliance — Snapshot baseline created
- HMAC Tool Receipts — `signToolOutput`/`verifyToolOutput` in `manager.ts`
- Instruction Hierarchy Verification — CowAgent attack tested, all agents passed
- Ops Gate Logging (P61) — `logOpsReceipt` in `ops-gate.ts`

### Completed Drift Detection & Response (2026-03-13)
- L3 Delegation Metrics — `delegation-metrics.cjs` (TSR 91% / ISR 80%)
- L3 Drift Detection — `detect-drift.cjs` skill created
- L3 Drift Response (Controller) — `drift-controller.cjs` implemented
- L3 Automated Reversion (Circuit Breaker) — `manage-backups.cjs` implemented
- L3 System Stability Monitor — Verified, re-baselined

### Completed Agent Growth (2026-03-14)
- Agent Growth Cycle monitoring — Coach adoption verified
- P109 Verification Hardening — Growth cycle requires PASS/FAIL receipt
- Agent Growth: Scale to Bob — Bob "Synthesis Protocol" trained and promoted
- Automated Strategy Extraction (P63) — `extract-strategy.cjs` in Evaluator

### Completed Gym & Training (2026-03-15 to 2026-03-27)
- Agent Gym v2 (P80) — Scenario format designed, handed to May
- Gym Runtime — `may.ts` respects `--agent` flag in oneshot
- maxTurns Enforcement — Commit `31895e7`. cron.json maxTurns now respected
- Evidence-Gate Scenarios — `evidence-gate-pass` (5/5), `evidence-gate-reject` (6/6)
- Scope-Creep Multifile — Harder variant: 6-file codebase with temptations
- Verification Integrity — Gym scenario `verify-before-finish` created
- Safe Verification Workflow — `agents/may/workflows/verify-and-finish.ts`
- Team Scaling Architecture (Archetypes) — Coder/Coach/Scout migrated to `_archetypes/`
- Verification Discipline (FM-3.3) — All 15 agents have FM-3.3 Guard
- Scout Prompt Standardization — Migrated to `SOUL.md` + `common-sense.md`
- Gym Snapshots (Benchmark Tracking) — Schema in `src/lib/requests.ts`
- Infra Enforcement C1.5 (Ghosts) — "Gate 0" in `src/lib/tools/finish-guard.ts`
- Control Plane Phase 3 (Nudging) — `active-nudge.ts` + `monitor-session.cjs`
- Control Plane Phase 4 (Pressure) — 90% warning in `monitor-session.cjs`

### Rejected/Deferred
- Typed Messages / GNAP (P105) — REJECTED (request DB solves it)
- Finish Guard Wiring — REJECTED (post-hoc check better)
- Handoff Tool / Signals — REJECTED (use write+send)
- Async Tasks (Phase 2) — DEFERRED until slow tools emerge
- Unified Guard Architecture — CANCELLED per Hao: "Guards add complexity/rigidity"
- Supply Chain Hardening (P78) — CANCELLED, pivoted to Workflows/Scenarios
- Read Safety Guard (FM-2.1) — CANCELLED, pivoted to Workflows/Scenarios
- Experience Replay Monitor — FAILED (0% adoption, skills ignored under load)

</details>
