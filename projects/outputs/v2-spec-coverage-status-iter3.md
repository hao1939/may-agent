# v2 Spec Coverage Buildout — Iteration 3 Status Assessment

**Date:** 2025-01-28
**Project:** v2-spec-coverage-buildout
**Priority:** P2 | **Status:** pending-review | **Coverage:** 0.1364 (3/22)

## Summary

This project remains intentionally deferred at P2 pending-review. All P0/P1 work is healthy, so no escalation is needed. This report documents the current state for iteration 3 tracking.

## Current Coverage Breakdown

| Status | Claims | Count |
|--------|--------|-------|
| ✅ Covered | C8, C10, S6 | 3 |
| ❌ Uncovered | C1-C7, C9, I1-I4, S1-S5, S7-S8 | 19 |
| **Total** | | **22** |

### Covered Claims Detail
- **C8** → `capability.session-trace-completeness`
- **C10** → `capability.status-reality-mismatch-count`
- **S6** → `v2.manager-loc` / `v2.runtime-glue-loc`

## Why No Action Now

1. **P2 priority** — P0/P1 projects take precedence and are all healthy
2. **Pending-review** — The project proposal itself hasn't been accepted for active work
3. **Design concern** — Raw metric chasing is discouraged; coverage should align with the unified work model (project context → goals, metrics → signals, agents → judgment)

## Recommended Trigger for Activation

- When all P0/P1 projects reach stable/done status
- When spec coverage drops below current baseline (regression)
- When a P0/P1 project explicitly depends on uncovered spec claims

## Next Steps (When Activated)

1. Phase 0: Ownership calibration — assign metric owners
2. Phase 1: Align uncovered claim measurements with active metrics
3. Phase 2: Register new metrics where genuine gaps exist
