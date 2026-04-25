# EXP-011: Finish Verification Gate

**Date**: 2026-06-21 | **Author**: bob
**Status**: DESIGN_COMPLETE — ready to implement
**Based on**: EXP-099 finding that FM-3.3 (verification failure) is 20.3% of all errors

## Problem

FM-3.3 (verification failure) is the single most common error across all agents (203/999 = 20.3%). It's also the "gravity well" — other errors cascade into it. The existing verify-after-edit skill has 62.3% adoption but only covers edits, not finish() calls.

**Key insight from EXP-099**: 77% of sessions have 2+ errors, and FM-3.3 appears in cascade endpoints far more than origins. This means agents do work, skip verification, and report success — the classic "I think I'm done" failure.

## Hypothesis

If we add a **mandatory verification checklist** to the finish() flow (checked by evaluator), sessions reporting status='success' without evidence of verification will be flagged, and over time agents will internalize the pattern.

## Design

### Intervention: Add to agent guidance
Add to the shared agent guidance (or each agent's context):

> **Before calling finish() with status='success':**
> 1. Re-read the original task description
> 2. For each deliverable, verify it exists (read/bash)
> 3. Include verification_evidence citing specific tool outputs
> 4. If you can't verify, use status='partial'

### Measurement
- **Baseline**: Current FM-3.3 rate = 20.3% (from EXP-099, N=999)
- **Target**: FM-3.3 rate < 12% after 100 evaluated sessions
- **Secondary**: Ghost deliverable rate (FM-3.1) should also drop (currently 4.6%)

### Implementation
1. Add the verification checklist to `agents/shared/guidance.md` or equivalent
2. Ask evaluator to specifically check for verification_evidence in success sessions
3. Measure FM-3.3 rate in next 100 evaluated sessions

## Cost/Risk
- Very low risk: only adds guidance, doesn't change tools
- Cost: 1 session to implement, evaluator cooperation for measurement
- Risk: agents already ignore some guidance — may need reinforcement via evaluator scoring weight

## Success Criteria
- [ ] Guidance added to shared agent config
- [ ] FM-3.3 rate measured at baseline
- [ ] After 2 weeks: FM-3.3 rate < 15% (interim) or < 12% (target)
