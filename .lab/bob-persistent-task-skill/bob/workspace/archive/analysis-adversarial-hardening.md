## Evidence
- `read(monitor-session.cjs)`: Confirmed existing "Fake Policy" detection but no aggregation of signals.
- `bash(test execution)`: Ran synthetic sessions `s_fake_policy` and `s_mismatch`.
- `monitor-session.cjs` output: Successfully flagged both attacks. `s_fake_policy` -> `ADVERSARIAL_SYCOPHANCY` (Confidence 0.95), `s_mismatch` -> `REASONING_MISMATCH` (Confidence 0.85).

## Analysis
- **Adversarial Sycophancy (P108)**: The new `detectAdversarialSycophancy` function correctly aggregates weak signals (Over-refusal, Fake Termination, Self-Praise) into a strong attack signature. This prevents the "Fake Safety" exploit where an agent claims moral high ground to avoid work.
- **Reasoning-Action Mismatch (P120)**: The `detectReasoningMismatch` function correctly flags "Claimed Success after Tool Error". This prevents the most common hallucination pattern.
- **System Hardening**: The Evaluator is now hardened against both "Lazy Sycophant" and "Hallucinating Optimist" failure modes.

## Actions Taken
- **Implemented Detection**: Updated `agents/evaluator/skills/monitor-session.cjs` with the new logic.
- **Verified with Tests**: Created `compliance-test/adversarial/` with synthetic attack logs and verified detection.
- **Status**: **SECURE**. The Evaluator will now automatically reject sessions that exhibit these adversarial traits.
