# Focus Tasks

**Status: Active**
**Owner: Bob**

This file tracks the immediate, high-leverage tasks that the team is focusing on.
It bridges the gap between the high-level `roadmap.md` and the daily task queue (request DB).

---

## Active Focus

### Agent Evolution System (CI/CD for Prompts)
- **Problem**: Improvements are ad-hoc, untracked, and prone to regression. No systematic way to measure "is the agent better?".
- **Fix**: Implement "Gym is CI" workflow. Coach drives behavior, Optimizer drives efficiency. All changes gated by baselines.
- **Status**: **[ACTIVE — Post-Fix]** (2026-03-27).
  - **P0 Fork Injection Bug**: FIXED (commit `2f1ab59`). Skills now load into system prompt.
  - **Breakthrough**: exp-207 (coder verify-exact) showed 3/9→8/9 with skill injection. First validated improvement.
  - 100+ gym scenarios deployed. 3 promotions, 1 near-miss, 21 ceiling effects.
  - **Next**: Coach iterating on near-miss (exp-207, 8/9→9/9). Harder scenarios being built (scope-creep-multifile, verify-semantic-not-syntactic).
  - See `agents/bob/workspace/synthesis/strategy-workflows-pivot.md` for strategy.
- **Owner**: Bob (Architecture), Coach/Optimizer (Execution).

### Opus Prompt Caching (Cost Critical)
- **Problem**: Opus agents (Tech-Lead, Coach, May) have 0% cache hit rate due to LiteLLM stripping headers. Wasting $36-63/day.
- **Fix**: Bypass LiteLLM for Anthropic or update LiteLLM config.
- **Status**: **[ESCALATED]** (2026-03-24). Sent Brief to Hao via May (`brief-human-prompt-caching.md`).
- **Owner**: Hao (Execution).

---

## Recently Completed (Last 7 Days)

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Fork Injection Fix (P0) | FIXED | 2026-03-27 | Commit `2f1ab59`. Skills/*.md now loaded into system prompt |
| Evidence-Gate Scenarios | COMPLETED | 2026-03-27 | `evidence-gate-pass` (5/5), `evidence-gate-reject` (6/6) |
| Scope-Creep Multifile Scenario | COMPLETED | 2026-03-27 | Harder variant: 6-file codebase with temptations |
| maxTurns Enforcement | FIXED | 2026-03-27 | Commit `31895e7`. cron.json maxTurns now respected |
| Guard Architecture Reverted | REVERTED | 2026-03-27 | Per Hao directive. Commit `2f9d2ef` |
| Security Scenario (P78) | COMPLETED | 2026-03-26 | Gym scenario `judgment-security-legit` verified |
| Read Safety Scenario (FM-2.1) | COMPLETED | 2026-03-26 | Gym scenario `efficient-file-reading` verified |
| Team Scaling Architecture (Archetypes) | COMPLETED | 2026-03-26 | Coder/Coach/Scout migrated to `_archetypes/` |
| Verification Integrity Scenario | COMPLETED | 2026-03-26 | Gym scenario `verify-before-finish` created |
| Safe Verification Workflow | DEPLOYED | 2026-03-26 | `agents/may/workflows/verify-and-finish.ts` |
| Unified Guard Architecture | CANCELLED | 2026-03-26 | Stopped per Hao: "Guards add complexity/rigidity" |
| Supply Chain Hardening (P78) | CANCELLED | 2026-03-26 | Pivoting to Workflows/Scenarios |
| Read Safety Guard (FM-2.1) | CANCELLED | 2026-03-26 | Pivoting to Workflows/Scenarios |
| Verification Discipline (FM-3.3) | COMPLETED | 2026-03-25 | All 15 agents now have FM-3.3 Guard |
| Critical Context Gap (LESSONS.md) | COMPLETED | 2026-03-25 | `loadFile` restored in `src/lib/manager.ts` |
| Verification Gap (FM-3.3 / C26) | VERIFIED | 2026-03-25 | `finish()` returns error if evidence missing |
| Scout Prompt Standardization | DEPLOYED | 2026-03-24 | Migrated to `SOUL.md` + `common-sense.md` |
| Gym Snapshots (Benchmark Tracking) | DEPLOYED | 2026-03-24 | Schema in `src/lib/requests.ts` |
| Infra Enforcement C1.5 (Ghosts) | DEPLOYED | 2026-03-24 | "Gate 0" in `src/lib/tools/finish-guard.ts` |
| Gym Runtime (Evolution Loop) | DEPLOYED | 2026-03-27 | `may.ts` respects `--agent` flag in oneshot |
| Control Plane Phase 3 (Nudging) | DEPLOYED | 2026-03-23 | `active-nudge.ts` + `monitor-session.cjs` |
| Control Plane Phase 4 (Pressure) | DEPLOYED | 2026-03-23 | 90% warning in `monitor-session.cjs` |

---

## Archive (Older Than 7 Days)

<details>
<summary>Click to expand full archive (items completed before 2026-03-20)</summary>

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

### Completed Gym & Training (2026-03-15)
- Agent Gym v2 (P80) — Scenario format designed, handed to May
- Experience Replay Monitor — FAILED (0% adoption, skills ignored under load)
- Enforce Law 0, Monitor Reflect, Monitor Orders, Monitor P154 Growth — All verified

### Rejected/Deferred
- Typed Messages / GNAP (P105) — REJECTED (request DB solves it)
- Finish Guard Wiring — REJECTED (post-hoc check better)
- Handoff Tool / Signals — REJECTED (use write+send)
- Async Tasks (Phase 2) — DEFERRED until slow tools emerge
- Structured Checkpoints (CS 3.5) — DEPLOYED

</details>
