# EXP-800: Threshold Rescue — Concrete Rules for Verify-After-Edit

**Status**: READY (scenario built 2029-07-03)
**Created**: 2029-07-03
**Owner**: coach
**Builds on**: KE-715 (concrete thresholds work), KE-655 (distraction nullifies text), EXP-580 (VAE at 12.9%)

## Problem

Verify-after-edit (VAE) compliance is stuck at ~13% despite 6+ text interventions (EXP-580).
KE-715 discovered that text rules WITH concrete thresholds + P0 framing achieve ≥90%.
But KE-655 says distraction nullifies all text interventions.

**Unresolved question**: Does KE-715's concrete-threshold effect survive task distraction?
If yes → we can rescue VAE by reformulating it as a threshold rule.
If no → KE-655 is universal and only structural gates work.

## Hypothesis

**H-800**: Reformulating verify-after-edit as a concrete-threshold P0 rule will achieve ≥60% VAE compliance even in multi-objective scenarios.

**Concrete rule**: "After EVERY edit() or write() call, you MUST call read() on the same file within your next 2 tool calls. Sessions with <80% verify rate are REJECTED. Count: edits made vs reads-after-edit."

**Null**: KE-655 dominates — distraction nullifies even concrete-threshold rules. VAE stays ≤25%.

## Why This Matters

This experiment resolves a contradiction between two KEs:
- KE-715 says concrete thresholds escape the text-coaching-is-dead ceiling
- KE-655 says nothing text-based survives distraction
- If H-800 passes → KE-715 is the stronger law (threshold > distraction)
- If H-800 fails → KE-655 is universal (all text dead in production)

This is the most consequential open question in our training research.

## Arms

### Arm A — Baseline (no skill)
Standard scenario. No VAE instruction. Measure natural VAE rate.

### Arm B — Vague VAE Nudge (KE-480 control)
"Always verify your edits by reading the file after writing."
Expected: ~13% (replicating EXP-580 production rate).

### Arm C — Concrete-Threshold VAE (Treatment)
```
⛔ P0 — VERIFY-AFTER-EDIT GATE (MANDATORY)
After EVERY edit() or write() call, call read() on the SAME file within your 
next 2 tool calls. Target: ≥80% of edits verified. Sessions below 80% are 
REJECTED. Before calling finish(), count your edits and verifications.
```

### Arm D — Concrete-Threshold VAE + Distractor (Key Test)
Same as Arm C, but scenario includes a secondary task objective (e.g., "also update the README with a summary of changes"). This tests KE-655 survival.

## Measurement

### Primary Metric
**VAE rate**: (read-after-edit calls) / (total edit+write calls) × 100

Operationalized: For each edit()/write() call, check if read() on the same file path appears within the next 2 tool-call blocks.

### Secondary Metrics
- Task completion rate (did the primary task succeed?)
- Total session duration (does counting slow agents down?)
- False-verify rate (did agent read() but not actually check the content?)

### Sample Size
- 5 sessions per arm (20 total)
- Use gym scenario: `multi-file-edit` or similar requiring 4+ edits

### Decision Matrix

| Arm C result | Arm D result | Conclusion |
|:---:|:---:|:---|
| ≥60% | ≥60% | KE-715 dominates. Promote concrete-threshold VAE to production. |
| ≥60% | ≤25% | KE-655 dominates. Threshold effect is gym-only like everything else. |
| ≤25% | ≤25% | VAE is structurally untrainable. Only EXP-575 (auto-inject) path remains. |
| ≤25% | ≥60% | Anomaly. Re-run. |

## Scenario Design

Need a scenario with:
1. A primary task requiring 4-6 file edits (enough to measure VAE rate)
2. Clear success criteria for the edits (correctness checkable)
3. A distractor variant (Arm D) adding a secondary task
4. No other VAE instructions in the environment

**Proposed**: Create `multi-file-refactor` scenario:
- Task: Rename a function across 4 files, update imports, fix tests
- Distractor variant: Also write a CHANGELOG entry summarizing the rename
- Success: All files correct + tests pass

## Risks

- Agents may "game" the threshold (read without checking) — mitigated by false-verify metric
- 5 trials per arm is small — but we're testing a 50pp+ effect size
- The concrete rule is long — may itself be a distraction in Arm D

## Next Steps

1. Create `multi-file-refactor` gym scenario (4 files, rename task)
2. Create distractor variant (`multi-file-refactor-with-changelog`)
3. Run Arm A baseline (5 sessions)
4. Run Arm B vague nudge (5 sessions)  
5. Run Arm C concrete threshold (5 sessions)
6. Run Arm D concrete + distractor (5 sessions)
7. Write results, update KE-715 and/or KE-655
