# Project: Test Coverage

**Status**: active
**Owner**: optimizer
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 0

## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: unknown → target 0.80
- test.critical-paths-covered: unknown → target 1.00

## Current State
New project. Some tests exist but coverage unknown. No coverage gates in build process.

## Plan
- [ ] Run coverage tool, identify untested critical paths, write outputs/coverage-baseline.md
- [ ] Write tests for top 5 untested critical paths
- [ ] Add coverage threshold to build process
- [ ] Re-plan: review coverage metric, write next steps

## References

**Resources:**
- src/ — main codebase
- test/ — existing tests
- agents/shared/workflows/ — workflow code (critical path)
