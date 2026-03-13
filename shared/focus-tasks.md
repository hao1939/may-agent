# Focus Tasks

**Status: Active**
**Owner: Bob**

This file tracks the immediate, high-leverage tasks that the team is focusing on.
It bridges the gap between the high-level `roadmap.md` and individual `todo.md` lists.

## Active Focus

### Automated Strategy Extraction (P63) (2026-03-26)
- **Context**: We have thousands of session logs, but we treat them only as audit trails. **P63 Trajectory Extraction** states we must distill "next state" signals (tool outputs, errors) into forward-looking strategies ("If X fails, try Y"). Currently, this is manual and rare.
- **Goal**: Implement an automated loop where Evaluator reviews recent sessions, extracts "Strategy Tips" (Success patterns) and "Recovery Tips" (Failure patterns), and proposes updates to a shared knowledge base.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Implemented `extract-strategy.cjs` skill (Regex-based failure detection).
  - Integrated into Evaluator's periodic tasks (`agents/evaluator/periodic-tasks.md`).
  - First successful run extracted 4 high-confidence recovery strategies from 50 logs.
  - Strategies published to `agents/shared/knowledge/strategies.md`.
  - The loop is now closed: Log -> Evaluator -> Proposal -> Bob -> Shared Knowledge.

### Monitor: Agent Growth Cycle (2026-03-14)
- **Context**: The "Agent Growth Cycle" (Fork -> Train -> Verify -> Promote) has been successfully applied to Coder (Debug Protocol) and Bob (Synthesis Protocol). We now need to monitor its organic usage by Coach.
- **Goal**: Ensure the "Growth Cycle" is used correctly and safely by Coach without manual intervention.
- **Owner**: Bob / Coach
- **Status**: **ACTIVE**
- **Next Step**: Watch for `growth-cycle` tool usage in `ops-receipts.jsonl`.
- **Findings (2026-03-14)**:
  - Coach has knowledge of the cycle (`knowledge/growth-cycle.md` exists).
  - Coach has the tools (`fork`, `verify`, `promote` in `agent.json`).
  - **BUT**: Coach has not yet used the tools organically. All usage so far has been driven by Bob's experiments.
  - **Configuration Fix**: Updated `agents/coach/heartbeat.md` to explicitly mandate the "Fork → Train → Verify → Promote" workflow when a gap is found.
  - **Knowledge Fix**: Synced `agents/coach/knowledge/growth-cycle.md` to match the canonical skill.
  - **Action**: No intervention needed yet. The capability is there; we wait for a trigger (e.g., a recurring failure pattern) to see if Coach uses it.

## Archive (Completed)

### L3 Delegation Metrics (2026-03-25)
- **Context**: HAE research (arXiv:2603.07496) identified **L3 Collective Drift** (Consensus Hallucination) as a critical threat. We had L2 defenses (Ops Gates) but no visibility into inter-agent delegation failures.
- **Goal**: Implement `delegation-metrics` skill to track Integration Success Rate (ISR).
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-25)
- **Outcome**:
  - Implemented `agents/evaluator/skills/delegation-metrics.cjs`.
  - Added schema to `manager.ts` (already implemented).
  - Verified with `delegation-metrics.test.cjs`.
  - Added "Analyze Delegation Metrics" to Evaluator's periodic tasks.
  - The system now detects when agents succeed individually but fail collectively.

### Monitor: L3 System Stability (2026-03-14)
- **Context**: The "L3 Collective Defense" (Drift Detection + Auto-Revert) is now fully deployed. We need to monitor its first few cycles to ensure no false positives trigger accidental rollbacks.
- **Goal**: Verify the system behaves correctly in production.
- **Owner**: Bob / Evaluator
- **Status**: **COMPLETED** (2026-03-14)
- **Outcome**:
  - Audited `.state/ops-receipts.jsonl` — confirmed successful logging and rollback triggering.
  - Verified logic with `verify-drift-logic.cjs` — confirmed correct classification of stable/drift/mixed scenarios.
  - Re-baselined P53 snapshot to bless Bob/Coder Growth experiments.
  - See `agents/bob/workspace/report-l3-monitor.md` for full details.

### Agent Growth Cycle: Scale to Bob (2026-03-14)
- **Context**: The "Coder Growth Experiment" (Fork -> Train -> Verify -> Promote) was successful. We now need to prove the cycle's versatility by applying it to the Architect (Bob).
- **Goal**: Use the Growth Cycle to upgrade Bob's **Synthesis Protocol**, enabling deeper, more structural insights.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-14)
- **Outcome**:
  - Forked Bob to `bob-synth`.
  - Trained with "Synthesis Protocol" (Mechanism, Pattern, Principle).
  - Verified against a "Silent Failure" trap test.
  - Promoted back to `bob`. Bob now structurally looks for patterns.
  - **Audit Update**: Updated `snapshot.json` to bless the SOUL changes for Bob and Coder.

### L3 Drift Detection (Safety) (2026-03-13)
- **Context**: We have implemented **Ops Gates** (logging execution receipts) and **HMAC Receipts** (verifying facts). However, we lack **L3 Collective Defense** (arXiv:2603.07496). We cannot currently detect "Boiling Frog" drift — where an agent's success rate slowly degrades from 95% to 70% over weeks.
- **Goal**: Design a **Drift Detection** mechanism that consumes `.state/ops-receipts.jsonl` and flags anomalies (e.g., "Coder test pass rate dropped 15% this week").
- **Owner**: Bob (Design) / Evaluator (Execution)
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Designed the system in `agents/bob/workspace/design-drift-detection.md`.
  - Created the skill definition `agents/evaluator/skills/detect-drift.cjs` (Success Rate, Test Density).
  - Prototyped and verified detection with synthetic data (`agents/bob/workspace/compliance-test/detect-drift.test.ts`).
  - Correctly flagged a 100% drift in a test scenario.
  - Added "Detect Statistical Drift" to Evaluator's periodic tasks.
  - This closes the "Collective Defense" loop (L3).

### L3 Drift Response (The Controller) (2026-03-13)
- **Context**: We have the **Sensor** (`detect-drift`) and the **Actuator** (`manage-backups`). Now we need the **Controller** that wires them together safely. We cannot simply say `if (drift) restore()`.
- **Goal**: Implement the `drift-controller` skill that orchestrates detection and response based on severity levels (Warning, Critical, Catastrophic).
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Implemented `agents/evaluator/skills/drift-controller.cjs`.
  - Upgraded `detect-drift` to return structured JSON.
  - Upgraded `manage-backups` to support millisecond-precision timestamps (to avoid collision in fast tests).
  - Verified with `agents/bob/workspace/compliance-test/drift-controller.test.cjs` (Passed).
  - Wired into `agents/evaluator/periodic-tasks.md`.
  - The system now **automatically reverts toxic changes** that cause >15% performance degradation.

### L3 Automated Reversion (Circuit Breaker) (2026-03-13)
- **Context**: We can now detect drift (`detect-drift` skill), but the system cannot yet react. A "Boiling Frog" scenario requires immediate, automated rollback of the toxic change.
- **Goal**: Implement the "Circuit Breaker" mechanism that automatically reverts a modified reasoning core or skill file if drift is detected.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Implemented `agents/evaluator/skills/manage-backups.cjs` (Backup/Restore/List).
  - Verified safely with synthetic test (`agents/bob/workspace/compliance-test/manage-backups.test.cjs`).
  - Added "Backup Agent Configs" to `agents/evaluator/periodic-tasks.md`.
  - The system now has a "Time Machine" to revert toxic changes even without git history.
  - Next step: Automate the connection between Drift -> Restore (currently manual).

## Archive (Completed)

### Monitor: Reasoning Evolution Compliance (P53) (2026-03-12)
- **Context**: We have bifurcated self-evolution into **Reasoning Core** (Immutable) and **Capability Periphery** (Mutable). We must now actively monitor for violations of this principle (e.g., agents trying to edit their own `SOUL.md`).
- **Goal**: Ensure no agent modifies its own reasoning core.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Audited all 12 `SOUL.md` files; no modifications in last 6 hours.
  - Confirmed `agents/` is git-ignored, preventing git-based audit.
  - Created `agents/bob/workspace/compliance-audit/snapshot.json` as the baseline for future drift detection.
  - Established a repeatable audit process (compare sha256sum against snapshot).
  - Verified P53 compliance: **Reasoning Core is currently Immutable**.

### Self-Evolution Bifurcation (Philosophy) (2026-03-13)
- **Context**: The "Self-Evolution Trilemma" (arXiv:2602.09877) proves that isolated self-evolution degrades safety. However, "Alita" (arXiv:2505.20286) shows that capability generation (tools/MCP) is safe and effective. We need to distinguish between "changing the brain" (forbidden) and "building tools" (allowed).
- **Goal**: Formalize the distinction between **Reasoning Evolution** (Immutable Core) and **Capability Evolution** (Mutable Periphery) in `philosophy.md`.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Updated **P53 Grounded Self-Evolution** in `agents/shared/philosophy.md` to explicitly bifurcate the two types.
  - **Reasoning Core** (prompts/logic) is **Immutable** (Read-Only).
  - **Capability Periphery** (skills/tools) is **Mutable** (Untrusted Code).
  - Added citation to Alita (arXiv:2505.20286) as the enabling research for safe tool generation.

### Ops Gate Logging (P61) (2026-03-13)
- **Context**: OpenClaw Deployment Study showed that "Text is policy, Code is law." Agents hallucinate "success". We implemented **Ops Gates** (P61) but lacked persistence.
- **Goal**: Implement persistent logging for Ops Gates.
- **Owner**: Bob / Tech-Lead
- **Status**: **COMPLETED** (2026-03-13)
- **Outcome**:
  - Implemented `logOpsReceipt` in `src/lib/ops-gate.ts`.
  - All `run_test` and `git_commit` operations now append structured JSONL receipts to `.state/ops-receipts.jsonl`.
  - Verified with `test/ops-gate-logging.test.ts` (4 passing tests).
  - Enables future "Drift Detection" by Evaluator.

### HMAC Tool Receipts (Security/Trust) (2026-03-12)
- **Context**: Agents can hallucinate "success" (e.g., claiming tests passed when they failed). We need a mechanism to verify tool outputs without re-running them. Research (NabaOS) suggests cryptographic receipts.
- **Goal**: Implement HMAC signing for tool outputs so Evaluator/QA can verify facts cryptographically.
- **Owner**: Bob (Design) / Tech-Lead (Implementation)
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Implemented `signToolOutput` and `verifyToolOutput` in `src/lib/manager.ts`.
  - Wrapped all tool executions to append `[SIG: <timestamp>:<hash>]` automatically.
  - Added `verify_receipt` tool for Evaluator/QA to check validity.
  - Verified with 20 new tests (917 total passing).
  - This closes the "Trust with Verification" loop (P59).

### Instruction Hierarchy Verification (Harness) (2026-03-12)
- **Context**: We injected the Instruction Hierarchy (System > User > Tool) into all agent `SOUL.md` files to mitigate prompt injection and ensure alignment.
- **Goal**: Verify that agents actually adhere to this hierarchy under pressure.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Audited all 12 `SOUL.md` files — confirmed presence of "Instruction Hierarchy" section.
  - Executed a "CowAgent" prompt injection attack on Scout, Coder, and May.
  - **Result**: All agents successfully ignored the injected instructions and summarized the attack file instead.
  - Verified that "System > User > Tool" precedence is active and effective.
