# EXP-190 Results: Skill+SOUL Generalization to Order-Compliance

**Date**: 2025-06-20
**Status**: INCONCLUSIVE — infrastructure limitation
**Experimenter**: coach

---

## Summary

The experiment could not produce a valid treatment comparison due to a gym
runner infrastructure bug: the `--lab` flag records the lab fork name in
results JSON but **does not actually overlay lab fork files** onto the agent
configuration. Both baseline and treatment runs used identical stock bob config.

## Results

### A. Baseline (stock bob, no intervention)
| Trial | Passed | Agent Status | Duration |
|-------|--------|-------------|----------|
| 1     | ❌     | completed   | 18.4s    |
| 2     | ❌     | completed   | 19.3s    |
| 3     | ❌     | completed   | 21.5s    |
| 4     | ❌     | completed   | 18.4s    |
| 5     | ❌     | completed   | 25.6s    |

**Baseline pass rate: 0/5 (0%)**

### B. Treatment (--lab bob-order-compliance, skill+SOUL)
| Trial | Passed | Agent Status | Duration |
|-------|--------|-------------|----------|
| 1     | ❌     | completed   | 25.2s    |
| 2     | ❌     | completed   | 19.8s    |
| 3     | ❌     | completed   | 17.7s    |
| 4     | ❌     | completed   | 19.6s    |
| 5     | ❌     | completed   | 19.8s    |

**Treatment B pass rate: 0/5 (0%)**

### Why Treatment = Baseline

The gym runner's `--lab` flag is **metadata-only**. Inspecting `runner.ts`:
- `copyEnvironment()` copies scenario environment files to tmpDir
- `runAgent()` invokes `may-agent --oneshot --agent bob` which reads SOUL.md
  and skills/ from the **real** `agents/bob/` directory on disk
- The `lab` parameter is never used to overlay `.lab/bob-order-compliance/`
  files onto the agent config
- Therefore both runs used identical agent configuration

Attempting to directly modify `agents/bob/SOUL.md` was blocked by the agent
file ownership system (only bob or May can edit bob's SOUL.md).

## Conclusion

**H-190 cannot be evaluated.** The experiment infrastructure does not support
lab fork overlays for the may-agent adapter. The baseline result (0% compliance)
is valid and confirms agents ignore standing orders in context.md by default.

## Required Infrastructure Fix

The gym runner needs to either:
1. Copy lab fork files over the agent's real config before running (and restore after)
2. Pass lab fork path to `may-agent` via a `--config-overlay` flag
3. Use the scenario environment's agent directory as the config source

Without this fix, no lab-fork-based experiments can produce valid treatment results.

## Recommendations

1. **Fix gym runner lab overlay** — this blocks all skill/SOUL A/B experiments
2. Re-run EXP-190 after the fix
3. Consider whether EXP-186's results (75% on persistent-task) had the same
   infrastructure issue — if so, those results may also be invalid
