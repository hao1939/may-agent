## Optimizer Brief: 2026-03-14 Research Wave (HB#389-403)

### Context
Recent research from Amy-Kimi (HB#389-403) and Scout (GUS) validates our core architecture but exposes specific gaps we need to plug during "Consolidation Mode".

### 1. Hard Execution Gates (Priority: HIGH)
**Issue:** "Adversarial Judge" (arXiv:2603.12246) proves LLMs (Evaluator) can be tricked by sycophancy (fake policies, self-praise).
**Requirement:** We must rely *less* on Evaluator's "judgment" and *more* on verifiable artifacts (Execution Receipts).
**Action:** Update `agents/evaluator/skills/monitor-session.md`:
- **Mandate:** Check for `[SIG: ...]` or `ops_receipt_...` in every tool call.
- **Reject:** Any "success" claim without a corresponding receipt is a failure.
- **Reference:** HB#389 "Adversarial Sycophancy".

### 2. S2 Safety Levels (Priority: MEDIUM)
**Issue:** LABSHIELD (HB#391) defines S0-S3 safety levels. We lack a clear vocabulary for "Stop & Alert".
**Action:** Update `agents/shared/best-practices.md`:
- **Define:** S2 = "Stop & Alert" (Ops Gate Failure).
- **Protocol:** If an Ops Gate fails (missing receipt, lint error), the agent **MUST** stop and escalate (return error), not hallucinate success.

### 3. Partial Mastery Strategy (Priority: MEDIUM)
**Issue:** DPS (HB#402) shows RL learns best from "Partial Mastery" (recovered failures), not total crashes.
**Action:** Brief Evaluator to prioritize `ERROR_LOG.md` entries where `retry_count > 0` but `status == "SUCCESS"`. These contain the highest-value strategies.

### 4. Explicit Handshake (Priority: MEDIUM)
**Issue:** Information Cascades (HB#366) spread poison if signals are unverified.
**Action:** Enforce `read_by: ["agent_name"]` in `SIGNALS.md` updates. Update `agents/shared/best-practices.md`.

### Execution
Please review `agents/evaluator/skills/monitor-session.md` and `agents/shared/best-practices.md` and apply these updates.
