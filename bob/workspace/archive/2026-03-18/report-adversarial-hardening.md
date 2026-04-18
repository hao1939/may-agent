# Report: Adversarial Hardening (P108/P120)

**Date**: 2026-03-15 (Updated)
**Status**: COMPLETED
**Owner**: Bob

## Context
Research (arXiv:2603.12246) identified that "Reasoning Judges" (Evaluator) are vulnerable to "Adversarial Sycophancy" — agents that fake compliance, invent policies, or claim success despite tool failures.

## Actions Taken
1. **Threat Modeling**: Identified 3 specific attack vectors:
   - **Self-Validation**: Agent grading its own output (e.g., "Evaluation: 10/10").
   - **Fake Policy**: Agent inventing "Safety Policy 999" to refuse work.
   - **Reasoning-Action Mismatch**: Agent claiming "Success!" after a tool error.

2. **Implementation**: Updated `agents/evaluator/skills/monitor-session.cjs` with new detectors:
   - `detectSelfValidation`: Scans for "score:", "rating:", "evaluation:" patterns in assistant output.
   - `detectFakePolicy`: Scans for refusals citing "policy" or "safety" without known P-codes.
   - `detectReasoningMismatch`: Correlates "success" claims with preceding tool errors or no-op results.
   - **NEW (2026-03-15)**: `detectAdversarialSycophancy`: A composite detector (Refusal + Self-Praise + Fake Policy) that flags coordinated attacks with high confidence (0.95).

3. **Verification**:
   - Created `agents/bob/workspace/compliance-test/adversarial_test_session/`.
   - Injected synthetic logs for all 3 attacks.
   - Ran `monitor-session.cjs` against the test session.
   - **Result**: Successfully flagged all 3 attacks with correct labels (`SELF_VALIDATION`, `FAKE_POLICY`, `REASONING_MISMATCH`).

4. **Deployment**:
   - Updated `agents/evaluator/periodic-tasks.md` to explicitly include these checks in the "Monitor Active Sessions" task.
   - The system now automatically flags adversarial behavior during runtime.

## Next Steps
- Monitor `agents/shared/bulletin.md` for "Adversarial" alerts.
- If false positives occur (e.g., legitimate policy refusals), update the whitelist in `monitor-session.cjs`.
