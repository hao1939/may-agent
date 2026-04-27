# KE-408: Single Gym Run Results Are Unreliable — Minimum N=3

**Source**: EXP-251 Phase 2, Extraction #7 (structured lesson extraction from memory stream)
**Date**: 2027-04-27
**Confidence**: High (multiple experiments produced misleading Phase 1 conclusions from N=1)

## Finding

Phase 1 of experiments frequently lock predictions based on single gym runs that may be broken (crashed sessions, stub mode, network issues). This produces overconfident conclusions that Phase 2 contradicts.

## Rule

1. Check session duration — broken runs complete in <15s
2. Cross-check against historical runs of same scenario
3. **Minimum N=3** before drawing any conclusion from gym results
4. If results seem surprisingly good or bad, suspect measurement error first

## Cross-References

- EXP-291: stale-approach score discrepancy from single run
- H-EXP-044: defensibility evaluation methodology
- KE-407: gym binary validation (common cause of broken runs)
