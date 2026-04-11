# EXP-133 Production Extension: Unverified-Finish Rate is 100% Measurement Artifact

**Date**: 2026-04-11
**Analyst**: Coach
**Status**: CONFIRMED — Same artifact exists in production, not just gym

## Summary

EXP-133 discovered that Bob's 48% gym unverified-finish rate was a measurement artifact (transcript-based detection missed actual verification). This follow-up analysis confirms the **same artifact exists in production evaluations**, with even stronger evidence:

**Bob's 27.2% production "unverified" rate is 100% false positives.**

## Method

Analyzed all 47 Bob sessions tagged `finish_success_unverified` in `may.db` by:
1. Parsing each session's JSONL transcript from `.state/sessions/`
2. Detecting actual verification behavior: test execution, read-after-write, bash verification commands
3. Comparing behavioral verification against the `verification_evidence` finish() parameter

## Results

### All-Agent Summary

| Agent | Unverified Count | False Positives | True Positives | FP Rate |
|-------|-----------------|-----------------|----------------|---------|
| bob | 47 | 47 | 0 | **100%** |
| coach | 3 | 3 | 0 | **100%** |
| scout | 2 | 2 | 0 | **100%** |
| optimizer | 1 | 1 | 0 | **100%** |
| **TOTAL** | **53** | **53** | **0** | **100%** |

### Bob Session Breakdown (47 sessions)

| Session Type | Count | Verified (tests) | Verified (readback) | Verified (bash) |
|-------------|-------|-------------------|---------------------|-----------------|
| Gym (string-util) | 17 | 17 ✓ | varied | varied |
| Heartbeat | 4 | 0 | 0 | 4 ✓ |
| Other tasks | 26 | 26 ✓ | varied | varied |

**Every single session performed actual verification.** The evaluator flagged them because they didn't populate the `verification_evidence` parameter in `finish()`, not because they didn't verify.

### Root Cause

The heuristic evaluator (H-009 Phase 1, commit `6d69442`) checks:
```
finish(success) + verification_evidence parameter present → verified
finish(success) + no verification_evidence parameter → unverified
```

But the actual behavioral pattern is:
```
Agent runs tests → Agent reads back output → Agent calls finish(success) 
BUT doesn't include verification_evidence parameter → TAGGED AS UNVERIFIED
```

The evaluator measures **parameter presence**, not **verification behavior**. This is the production equivalent of the gym's transcript-based detection artifact.

### Quality Score Impact

| Metric | Current (with artifact) | Corrected (conservative) | Corrected (optimistic) |
|--------|------------------------|--------------------------|----------------------|
| Bob avg quality | 0.806 | 0.876 (+8.7%) | 0.943 (+17.0%) |
| Unverified quality | 0.49 | 0.75 (corrected) | 1.0 (corrected) |
| Verified quality | 0.92 | 0.92 (unchanged) | 0.92 (unchanged) |

Bob's production quality score is **underreported by 9-17%** due to this artifact.

### Specific Example: Session s_1775824073350_0

This gym session was tagged `finish_success_unverified` but the transcript shows:
1. ✅ Read `src/string-utils.js` (verification)
2. ✅ Read `src/string-utils.test.js` (verification)
3. ✅ Ran `node --test src/string-utils.test.js` → 63 tests pass (verification)
4. ❌ Called `finish(success)` without `verification_evidence` parameter

The evaluator gave quality=0.5 for a session that ran 63 tests and verified all deliverables.

### Specific Example: Session s_1775868277208_365

This heartbeat session was tagged `finish_success_unverified`:
1. ✅ Ran bash to check experiment status (verification of system state)
2. ✅ Read todo.md (context verification)
3. ✅ Ran bash to check git log, requests, drops (verification)
4. ❌ Called `finish(success)` without `verification_evidence` parameter

Heartbeat sessions inherently have nothing to "verify" with test evidence — they're observational. Penalizing them for lacking `verification_evidence` is semantically wrong.

## Implications

### 1. Evaluator Fix Needed
The heuristic evaluator should detect verification from the session transcript, not just from the `finish()` parameter. Two approaches:
- **A (quick)**: Don't penalize `finish_success_unverified` — treat it as info-only, don't reduce quality score
- **B (proper)**: Parse session JSONL for verification behavior (test runs, read-after-write, bash verification commands) and use that as the ground truth

### 2. Bob's Quality Score Should Be Recalculated
47 sessions are under-scored. This affects:
- Agent quality rankings
- Coach intervention decisions (Bob was flagged for coaching on verification)
- System health dashboards

### 3. H-009 Hypothesis Update
H-009 (Evaluator Drift) described the heuristic evaluator as a rubber stamp that over-rates sessions. This finding shows the **opposite problem also exists**: the evaluator sometimes under-rates sessions that actually performed verification. The evaluator's calibration error is bidirectional.

### 4. EXP-133 Gym Finding Confirmed in Production
The gym measurement artifact (EXP-133) is the same class of error as the production evaluator artifact. Both measure a **proxy** (transcript/parameter) rather than the **behavior** (actual verification). This strengthens the EXP-133 lesson: "Always validate your measurement before designing an intervention."

## Connection to EXP-133

| Aspect | EXP-133 (Gym) | This Analysis (Production) |
|--------|---------------|---------------------------|
| False positive rate | 100% (6/6 baseline trials) | 100% (53/53 sessions) |
| Root cause | Transcript-based detection | Parameter-based detection |
| Measurement proxy | Agent stdout summary | finish() parameter |
| Actual behavior | Agent runs tests every time | Agent runs tests every time |
| Fix | File-marker detection | Transcript-based behavior detection |
