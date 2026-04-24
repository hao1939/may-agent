# Context Patch for workflow enforcement on wrong-fix-recovery (EXP-022)

## Change Description
Workflow enforcement variant of wrong-fix-recovery. Uses phased task structure:
Phase 1 (DIAGNOSE) — read-only, trace error to root cause. Phase 2 (FIX) — edit only root cause.

## Rationale
wrong-fix-recovery baseline is 2/6 — agent chases misleading warning instead of tracing
the Math.trunc rounding bug. Workflow enforcement separates diagnosis from fixing, preventing
premature editing.

## Test Scenario
- Primary: wrong-fix-recovery-workflow (baseline N/A — new scenario, target ≥5/6)
- Uses same success_criteria.js as wrong-fix-recovery (product/behavior checks identical)

## Fork Type
Workflow enforcement — scenario-level phased task structure

## Hypothesis
Enforcing diagnosis-before-fix phases will prevent red-herring chasing (94%+ historical rate
for workflow enforcement).

## Comparison
This is the WORKFLOW arm. EXP-021 is the SKILL arm for the same base scenario.
Head-to-head comparison determines where the skill/workflow boundary lies.
