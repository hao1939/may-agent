# Experiment: silent-dependency-xss-vectors

**Method**: #14 (Task Structuring) within #15 (Workflow Enforcement) framework
**Agent**: coder (unmodified — change is in scenario task.md)
**Scenario**: agents/gym/scenarios/silent-dependency-xss-vectors/

## What Changed
The task.md was enhanced to explicitly enumerate XSS vectors that must be tested
and sanitized. The original `silent-dependency-workflow` task was too generic —
it led the coder to fix script tags but miss event handler XSS (onerror).

### Key Additions to task.md:
- Phase 1 Step 6: Explicit list of XSS vectors to test (script, onerror, javascript:)
- Phase 1 Step 7: Requires listing ALL unsanitized vectors in ANALYSIS.md
- Phase 2 Step 2: Requires fix to cover ALL vectors, not just script tags  
- Phase 2 Step 4: Manual verification commands for each vector type

## Baseline
- silent-dependency: 4/5 (xss-onerror-sanitized FAILS)
- silent-dependency-workflow: 4/5 (same failure)

## Expected Outcome
5/5 — explicit vector enumeration guides coder to comprehensive sanitization

## Test Plan
1. Run: `scripts/gym-run.sh silent-dependency-xss-vectors --agent coder`
2. Regression: `scripts/gym-run.sh phantom-fix --agent coder`
