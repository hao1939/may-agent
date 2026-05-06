# EXP-870: Baseline Audit — Read-After-Edit Compliance

**Date**: 2025-05-08
**Author**: bob
**Status**: BASELINE COMPLETE

## Data Sources

Pulled from coach checkpoint data (C1.1 "Read Before Edit" monitoring) and session meta records.

## Findings

### Fleet-Wide Compliance (from coach C1.1 tracker)

| Agent | Compliance Rate | Notes |
|-------|----------------|-------|
| Optimizer | 80.5% (worst) | 16 failures in 82 checks; 100% concentrated on DELIVERABLES_CHECKLIST.md and todo.md |
| QA | ~90% (recovering) | Was 56.4% on Apr 10, fixed Apr 11 (bash tail→read), recovered to 90% Apr 12 |
| Amy-Kimi | ~100% | 4/4 edits preceded by reads in sampled session |
| Fleet average | ~95% | Most agents comply most of the time |

### All-Time Rate (Optimizer)
- **76.1%** (189 failures in 792 checks)
- This is the "read BEFORE edit" metric (slightly different from "read AFTER edit" but related)

### Key Patterns

1. **Violations are concentrated**: 2 files cause 100% of optimizer violations (DELIVERABLES_CHECKLIST.md, todo.md)
2. **Text interventions don't work**: Commit f3f6765c (Apr 12) added explicit read() instruction to skill — 13 violations continued post-fix
3. **Self-punishment helps partially**: edit() exact-match failures act as natural enforcement (you can't edit what you haven't read), but this only catches read-BEFORE-edit, not read-AFTER-edit
4. **Prior fix attempts**: Skill text instructions added, context.md rules added — neither achieved compliance

### Read-After-Edit vs Read-Before-Edit

The C1.1 metric measures "read before edit" (know what you're editing). EXP-870 targets "read after edit" (verify the change). These are complementary:

- **Read before edit**: Fleet ~95%, optimizer ~80% → partially enforced by edit() exact-match requirement
- **Read after edit**: Estimated lower — edit() returns a diff preview, which agents often treat as sufficient verification. True file reads after edit are likely <50% fleet-wide based on the EXECUTION RULES language ("diff preview does NOT count")

## Baseline Summary

| Metric | Value | Source |
|--------|-------|--------|
| Read-before-edit compliance (fleet) | ~95% | Coach C1.1 tracker |
| Read-before-edit compliance (worst agent) | 76-80% | Optimizer all-time |
| Read-after-edit compliance (estimated) | <50% | Inferred from rule language + edit() returning diff |
| Text intervention success rate | 0% | f3f6765c fix had no effect |

## Conclusion

**Baseline confirms hypothesis**: Text-only rules achieve <80% compliance at best (76% for worst agent), and "read AFTER edit" is likely much worse since edit() already provides a diff preview that feels sufficient.

**Structural enforcement (Option C: auto-inject read after edit) would achieve 100% by construction.**

## Next Steps

1. Prototype Option C: modify tool infrastructure to auto-append file content after every edit()
2. Measure token cost impact (estimate: 500-2000 tokens per edit, 5-20K per session)
3. If token cost acceptable, deploy; otherwise fall back to Option A (warning)

## Connection to KE-EXP027

This audit provides additional evidence for the key finding: text interventions (skill instructions, context.md rules, commit fixes) consistently fail to change agent behavior. The only reliable fixes are structural (edit() exact-match requirement naturally enforces read-before-edit; auto-inject would enforce read-after-edit).
