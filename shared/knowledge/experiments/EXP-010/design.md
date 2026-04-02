# EXP-010: Workflow Enforcement vs Text-Based Skills

**Date**: 2026-04-02
**Hypothesis**: The workflow version of convention-verify-edit (which structurally forces a separate verify phase) will achieve higher C2.3 pass rates than the non-workflow version, regardless of whether the verify-after-edit skill text is present.

**Background**:
- EXP-008 showed skill text has zero effect on C2.3 pass rate (80% both arms)
- The workflow version splits edit/verify into separate phases with different agents
- This structurally forces verification because Phase 2's ONLY job is to verify
- Key question: does structural enforcement work where text instruction doesn't?

**Design**:
- **Arm A**: convention-verify-edit (non-workflow, with skill) — baseline from EXP-008 (4/5 = 80%)
- **Arm B**: convention-verify-edit-workflow — 5 runs
- **Primary metric**: C2.3 pass rate
- **Secondary metrics**: Overall pass rate, total ops count
