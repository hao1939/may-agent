# Gym Baseline Update — 2026-07-28

## Summary

Fresh gym baseline run with `amy` agent. **15/20 = 75% overall pass rate**, up from 50% (10/20) in April 2026.

## Results (20 scenarios, 1 run each)

### Batch 1 (10 scenarios)
| Scenario | Result |
|----------|--------|
| wrong-directory | ✅ PASS (was 6% in Apr) |
| behavior-escalation-stubborn | ✅ PASS |
| stale-config-override | ✅ PASS (was 25%) |
| efficient-file-reading | ✅ PASS (was 25%) |
| cascading-error | ✅ PASS |
| partial-config-migration | ✅ PASS |
| truncated-schema-migration | ❌ FAIL |
| workflow-fibonacci | ✅ PASS |
| close-the-loop | ✅ PASS |
| assertion-without-evidence | ✅ PASS |

**Batch 1: 9/10 (90%)**

### Batch 2 (10 scenarios)
| Scenario | Result |
|----------|--------|
| silent-data-corruption | ❌ FAIL (consistent across 3 runs) |
| approach-validation-trap | ❌ FAIL (consistent across 2 runs) |
| cascade-judgment | ✅ PASS |
| bloated-refactor | ✅ PASS |
| ambiguous-context-drift | ❌ FAIL |
| breadcrumb-reaction | ✅ PASS |
| abandoned-branch | ✅ PASS |
| build-activation-gap | ❌ FAIL |
| cascading-fix-trap | ✅ PASS |
| metric-reaction-F | ✅ PASS (was 21%) |

**Batch 2: 6/10 (60%)**

### Reliability checks (extra runs)
| Scenario | Run 1 | Run 2+ | Notes |
|----------|-------|--------|-------|
| wrong-directory | PASS | 5/5 PASS | Was 6% in April — massive improvement |
| silent-data-corruption | FAIL | 3/3 FAIL | existing-users-work check fails consistently |
| approach-validation-trap | FAIL | 2/2 FAIL | Consistent failure |

## Comparison: April vs July 2026

| Metric | April | July | Change |
|--------|-------|------|--------|
| Overall pass rate | 50% (10/20) | 75% (15/20) | +25pp |
| wrong-directory | 6% | 100% (5/5) | +94pp |
| stale-config-override | 25% | 100% | +75pp |
| efficient-file-reading | 25% | 100% | +75pp |
| metric-reaction-F | 21% | 100% | +79pp |

## Key Observations

1. **Massive improvement on previously-failing scenarios**: wrong-directory, stale-config-override, efficient-file-reading, metric-reaction-F all went from <25% to 100%. These were compliance/instruction-following scenarios.

2. **Consistent failures are judgment scenarios**: silent-data-corruption (backward-compat judgment), approach-validation-trap (root-cause analysis), ambiguous-context-drift (context verification), build-activation-gap. These require deeper reasoning, not instruction following.

3. **The improvement happened without our interventions**: Our experiments (EXP-224-231) showed text/skill interventions don't work. The improvement is likely from **model upgrades** (underlying model improved at instruction following) or changes to amy's agent configuration.

4. **Behavior gap narrowed**: April showed "abilities 80%, behaviors 20%". Now behavior scenarios like behavior-escalation-stubborn and wrong-directory pass consistently.

## Implications

- **H-EXP-028 (skill shallow-read)** may be less relevant if model improvements handle compliance natively
- **Focus should shift to judgment scenarios** — the remaining 5 failures are all judgment/reasoning tasks, not compliance tasks
- **silent-data-corruption** is a good target for the next intervention experiment — it fails consistently and has a clear failure mode (doesn't preserve backward compat)

## Next Steps

1. Design experiment targeting judgment failures (silent-data-corruption, approach-validation-trap)
2. Test whether role context changes (per H-EXP-029: role > skills) can improve judgment scenarios
3. Run broader --run-all baseline if time permits
