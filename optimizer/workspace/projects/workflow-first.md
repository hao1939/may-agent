# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0

## Goal
Make workflows the default execution pattern. Every recurring agent task should have a workflow.

## Key Metrics
- Workflow coverage: % of agent tasks that use a named workflow
- Current estimate: ~60%
- Target: 80%+

## Principles
1. If you do it twice, make it a workflow
2. Workflows should be discoverable (REGISTRY.md)
3. Measure workflow vs freestyle ratio
4. Retire workflows that arent used

## Current Workflows (audit)

| Workflow | References | Status |
|----------|-----------|--------|
| verify-wrap | 539 | Keep |
| growth-cycle | 85 | Keep |
| parallel-research | 54 | Keep |
| implement-and-verify | 49 | Keep |
| implement-and-review | 49 | Keep |
| persistent-task | 36 | Keep |
| training-sprint | 29 | Keep |
| coaching-feedback | 4 | Dead |
| error-scan | 2 | Dead |
| auto-loop | 0 | Removed |
| skill-lifecycle | 0 | Removed |

## Next Actions
1. Create review-output workflow (top freestyle candidate — see finding-freestyle-patterns-0419.md)
2. Increase workflow coverage from 60% toward 80%
