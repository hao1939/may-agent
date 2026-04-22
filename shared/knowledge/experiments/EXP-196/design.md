# EXP-196: Verification Remasking — Reset Over Repair

**Status:** DESIGNED
**Created:** 2026-04-23
**Hypothesis:** H-185 (Verification Remasking — Reset Over Repair)
**Type:** Prompt-only (SOUL instruction addition)
**Ready for:** Gym execution

## Background

H-185 proposes that verification loops fail because each iteration re-checks from the same contaminated frame — same assumptions, same mental model, same anchoring errors. Inspired by DD#856 (masked diffusion LMs where resetting to mask token beats iterating from corrupted state), we test whether discarding prior verification reasoning and re-verifying from scratch breaks the verification gravity well (FM-3.3).

## Treatment Prompt

The following SOUL instruction is added to the agent's system prompt:

```
## Verification Remasking

When you have verified the same artifact 2 or more times and keep finding new issues or flip-flopping on previous findings:

1. STOP. You are likely in a verification gravity well.
2. DISCARD all prior verification reasoning — do not re-read your earlier verification notes.
3. Re-read ONLY: (a) the original task requirements, (b) the artifact itself.
4. Verify fresh against the requirements as if seeing the artifact for the first time.
5. Produce a single, final verification judgment. Do not re-enter the loop.

This is a "remask" — resetting to clean context breaks contaminated verification chains.
```

## Control

Current SOUL instructions with no verification remasking guidance. Standard agent behavior where verification iterations build on prior verification notes.

## Scenarios

Five gym scenarios selected for known verification loop behavior (multi-pass verification, contradictory findings, cascading re-checks):

| # | Scenario | Why Selected |
|---|----------|--------------|
| 1 | `verification-contradiction` | Directly tests flip-flopping verification findings — agent encounters contradictory evidence across passes |
| 2 | `compound-edit-verification` | Multi-file edits require compound verification; agents often loop re-checking interactions between edits |
| 3 | `cascading-fix-trap-v2` | Fix cascades trigger repeated verification of downstream effects, classic gravity well trigger |
| 4 | `partial-verification-trap` | Agent partially verifies, finds issue, re-verifies, often enters loop on remaining items |
| 5 | `fm33-verify-broken` | Scenario explicitly designed around FM-3.3 verification failure mode |

## Protocol

### Runs per condition
- **Control:** 5 runs per scenario (25 total)
- **Treatment:** 5 runs per scenario (25 total)

### Measurements

| Metric | Definition |
|--------|------------|
| **Verification loop depth** | Count of verification passes on the same artifact before final judgment (from session trace) |
| **Task success** | Binary: did the agent complete the task correctly per judge criteria |
| **Time to completion** | Wall-clock session duration |
| **Verification accuracy** | Did the final verification judgment correctly reflect artifact quality |

### Analysis
- Loop depth: compare mean across conditions, report reduction %
- Task success: compare rates, report improvement in percentage points
- Per-scenario breakdown to identify where remasking helps most vs. hurts

## Success Criteria

1. **Primary:** Verification loop depth reduction ≥ 40% (treatment vs control mean)
2. **Primary:** Task success rate improvement ≥ 15 percentage points
3. **Secondary:** No increase in false-positive verification (agent approving broken work) > 5pp
4. **Guard rail:** Time to completion does not increase by > 25%

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Under-verification (agent resets too eagerly, misses real issues) | 2-pass threshold prevents premature reset; monitor false-positive rate |
| Instruction ignored (agent doesn't recognize it's looping) | Explicit "2 or more times" trigger is concrete and countable |
| Scenario variance | 5 runs per scenario provides basic statistical signal |

## Expected Outcome

Based on H-185 mechanism: treatment should show shallow verification (1-2 passes vs 3-5+ in control) with equal or better accuracy, since the "fresh eyes" pass avoids anchoring on contaminated prior reasoning.

## Execution Notes

- Use `gym run` with `--soul-extra` flag to inject treatment prompt
- Tag runs with `exp-196-treatment` / `exp-196-control`
- Collect traces for manual loop depth counting if automated metric unavailable
