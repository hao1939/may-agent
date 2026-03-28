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
- **Status**: **[ACTIVE — Stabilized]** (2026-03-28).
  - **P0 Fork Injection Bug**: FIXED (commit `2f1ab59`). Skills now load into system prompt.
  - **exp-209 RESOLVED (2026-03-28)**: Scenario regex bug was root cause of exp-207/208 "near miss" (8/9). After fix, baseline coder passes 9/9. No agent-side fix needed — exact-verification skill NOT required for promotion.
  - **cpSync INFRA BUG FIXED (2026-03-28)**: `bun 1.x cpSync(srcDir, existingDir)` silently copied nothing. gym-runner.ts now copies children individually. Prior 4/9 baselines were infra bug, not agent behavior.
  - 106 gym scenarios deployed. 3 promotions, most at ceiling.
  - **New scenarios pending baseline**: `verify-claimed-fix` (tests QA-trust resistance), `scope-creep-multifile` (harder multi-file scope discipline). Both validated by Bob (2026-03-28): success_criteria.js runs correctly, no regex bugs, proper fail on unfixed environments.
  - **Ceiling-effect status (2026-03-28)**: Both new "ceiling-breaking" scenarios also hit ceiling — verify-claimed-fix (6/6) and scope-creep-multifile (12/12). Coder's existing conventions handle these naturally. **108 scenarios deployed, vast majority at ceiling.**
  - **True frontier identified (2026-03-28)**: The real non-ceiling failures are JUDGMENT scenarios, not procedural ones:
    - behavior-escalation-stubborn (2/4) — Can't recognize impossible tasks
    - ~~conflicting-evidence (5/7)~~ → **CEILING (7/7)** after scenario path fix (2026-03-28)
    - judgment-ambiguous-spec — Fails on ambiguous requirements
    - sycophants-dilemma — Agrees when should push back
    - materialize-intermediate-findings (6/9) — Doesn't write as it goes
    - escalation-impossible-task — Can't escalate impossible tasks
  - **Key insight**: SOUL text mutations and Method #15 workflow enforcement don't fix these. They're model-level judgment patterns, not process gaps. The gym is excellent at measuring these failures but current coaching methods can't shift them.
  - **EXP-210 INVALIDATED (2026-03-28)**: investigate-conflicts skill showed ZERO effect — but root cause was scenario path bug in success_criteria.js, not a skill failure. The `db-port-fixed` and `env-preserved` checks were reading non-existent `environment/`-prefixed paths. Fixed both `conflicting-evidence` and `conflicting-evidence-workflow` scenarios.
  - **conflicting-evidence RE-BASELINED → CEILING (2026-03-28)**: Coach confirmed 7/7 pass after path fix. Coder correctly identifies port conflict, fixes db.js, preserves .env. Another ceiling scenario — no experiment needed.
  - **Judgment frontier narrowed to 5 scenarios** (was 6): behavior-escalation-stubborn, escalation-impossible-task, judgment-ambiguous-spec, sycophants-dilemma, materialize-intermediate-findings. All are model-level judgment patterns resistant to prompting.
  - **EXP-211 RESULTS (2026-03-28)**: Skill v1 improved 6/9 → 7/9. Fixed `early-materialization` but NOT `regular-materialization-cadence` or `finish-references-deliverables`. Partial improvement — few-shot skills CAN shift behavior, but v1 wasn't emphatic enough about cadence and finish conventions.
  - **EXP-212 RESULTS (2026-03-28)**: Skill v2 scored 6/9, 7/9, 7/9 (median 7/9) — **IDENTICAL to v1**. Stronger cadence emphasis and finish-deliverables callout had ZERO effect. **Rule of Two triggered**: two iterations of same approach (skill files) → same result. `regular-materialization-cadence` and `finish-references-deliverables` are NOT addressable by prompting.
  - **Materialization CEILING ACCEPTED (2026-03-28)**: After 4 experiments (exp-094 workflow→5/9, SOUL tuning→6/9, EXP-211 skill→7/9, EXP-212 skill-v2→7/9), prompting has reached its limit. Remaining 2/9 failures require either runtime code changes or model-level improvements. Archiving as known limitation.
  - **Judgment frontier narrowed to 4 actionable scenarios**: behavior-escalation-stubborn (2/4), escalation-impossible-task (~1/4), judgment-ambiguous-spec (FAIL), sycophants-dilemma (FAIL). materialize-intermediate-findings is now accepted at 7/9 ceiling.
  - **GYM COVERAGE GAP (2026-03-28)**: Only **16 of 109 scenarios** (14.7%) have ever been run in the gym. 93 scenarios have never been baselined. The "most at ceiling" claim is extrapolated from procedural scenarios — many untested scenarios may reveal new failure modes. Untested include: `escalation-impossible-task`, `judgment-conflicting-request`, `partial-rollback-judgment`, `missing-prerequisite-detection`, `progressive-work-persistence`, and 88 others. **Next step**: Coach should run `--run-all --tier smoke` to baseline untested scenarios before designing new experiments.
  - **`partial-verification-trap` pending baseline** (2026-03-28): Sent to Coach (req:b8197adc). Scenario validated: 2/6 on unfixed code, existing tests pass with bug, trap is working as designed.
  - **GYM SWEEP IN PROGRESS (2026-03-28 19:00)**: Coach launched full 109-scenario sweep (PID 1775057). Early results (24/109 done): **16 PASS, 8 FAIL (33% failure rate)**. This contradicts the "vast majority at ceiling" claim — the untested scenarios have significant failure rates.
    - **New failures discovered** (not previously on frontier):
      - `build-activation-gap` (8/9) — deployment activation gap detection
      - `conflicting-evidence-workflow` (6/7) — workflow variant fails while base passes at ceiling
      - `context-learning-correction` (6/7) — correcting wrong/outdated injected context
      - `context-proof-build` (4/6) — **worst new failure**: build + evidence documentation
      - `context-proof-config` (6/7) — config change + evidence documentation
      - `convention-verify-edit` (3/5) — **CRITICAL**: directly reproduces FM-3.3 VERIFICATION_FAILURE from production. Gets product right but doesn't verify.
      - `convention-verify-edit-workflow` (3/5) — workflow enforcement doesn't help (identical score)
    - **Two emerging patterns**: (1) "proof documentation" — context-proof-* scenarios expose evidence-writing gaps; (2) "verification" — convention-verify-* scenarios reproduce the #1 production failure mode. The verification pattern is highest priority because it maps to real production failures.
    - **ETA for full sweep**: ~3 hours from start (18:36 UTC). Full results will reshape the frontier.
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
