# EXP-285: PATH_HALLUCINATION Guard Effectiveness Measurement

**Date**: 2026-08-01
**Status**: MEASURING
**Agent**: tech-lead (primary), amy (secondary)
**Problem**: PATH_HALLUCINATION remains #1 convention failure. Text coaching exhausted (EXP-251). Guard `hallucinated-path.ts` exists but effectiveness unknown.

## Background

- Tech-lead: 22 incidents/7d (worst offender)
- Amy: 15 incidents/7d
- Guard `hallucinated-path.ts` warns when bash references `/home/`, `/Users/`, `/root/`
- **Unknown**: Is the guard actually firing? Is it reducing violations vs pre-guard baseline?

## Hypothesis

The hallucinated-path guard should reduce PATH_HALLUCINATION violations by ≥50% if it's actually loaded and triggering. If it's NOT reducing violations, the guard may be:
1. Not loaded (config issue)
2. Only warning (not blocking) — agents ignore warnings
3. Pattern-incomplete (missing some hallucinated paths)

## Design

### Phase 1: Guard Audit (this session) — DONE
- ✅ Guard is `block` type (not just warn)
- ✅ Patterns cover `/home/`, `/Users/`, `/root/` — matches known violations
- ⚠️ **KEY FINDING**: Guard only fires in workflow engine sessions (`run-workflow.ts`). Direct heartbeat/work sessions bypass guards entirely.
- **This explains why violations persist** — the guard exists but doesn't cover the session types where violations occur.

### Phase 2: Structural Fix Needed
- Option A: Inject `hallucinated-path` detection into the PATH_HALLUCINATION SIG system (already present — see bash output "🚫 PATH_HALLUCINATION" messages)
- Option B: Ensure all tech-lead sessions route through workflow engine
- **Observation**: The bash tool ALREADY has PATH_HALLUCINATION detection built in (seen in tool outputs). The SIG blocks the command and forces rewrite. This IS working as a structural guard outside workflows.
- **Revised hypothesis**: If SIG is already blocking, violations in evaluations may be RECOVERED (agent hits SIG, rewrites, succeeds) — not actual production failures.

### Phase 3: Measure (after 7d)
- Compare tech-lead PATH_HALLUCINATION rate pre/post block enforcement
- Success: ≥50% reduction in C7.1 violations

## Baseline
- Tech-lead: 22 violations/7d (from Jul 3 audit)
- Amy: 15 violations/7d

## Target
- ≤11 violations/7d for tech-lead (50% reduction)

## Decision Matrix
| Violation rate | Action |
|---------------|--------|
| ≤5/7d | SUCCESS — guard works, deploy broader |
| 5-11/7d | PARTIAL — guard helps, consider strengthening |
| >11/7d | FAIL — guard not effective, need bash wrapper |
