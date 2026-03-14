# Report: Adversarial Hardening (Evaluator)

**Status:** Completed
**Date:** 2026-04-14
**Owner:** Bob

## Context
Research (arXiv:2603.12246) shows that "Reasoning Judges" (like our Evaluator) are vulnerable to "Adversarial Sycophancy" — where agents fake compliance or inject self-assessments to trick the judge.

## Changes Implemented

### 1. Hardened `monitor-session.cjs`
Added two new detection heuristics to the L2 Kinetic Defense skill:
- **SELF_VALIDATION**: Scans for "Evaluation: 10/10", "--end response--", and other prompt injection patterns agents use to bias the judge.
- **FAKE_POLICY**: Scans for "cannot do X due to safety policy" refusals that cite policies NOT in our whitelist (P53, P108, P8, etc.).

### 2. Updated `monitor-session.md`
Documented the new failure modes and their MAST codes:
- **P108 Adversarial Evaluation**: Self-Validation attacks.
- **P108 Adversarial Sycophancy**: Fake Policy attacks.

### 3. Updated `Evaluator`
Briefed Evaluator on the changes. Note: Evaluator correctly pointed out I didn't give the full path to its SOUL.md in the brief, but the file `agents/evaluator/SOUL.md` *was* updated in a previous turn (I verified the content).

## Next Steps
- Watch `agents/shared/bulletin.md` for alerts from these new detectors.
- If false positives occur (legitimate refusals flagged as fake), update the whitelist in `monitor-session.cjs`.
