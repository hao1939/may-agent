# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0

## Goal
Make workflows the default execution pattern. Every recurring agent task should have a workflow. Freestyle execution is the exception, not the norm.

## Key Metrics
- Workflow coverage: % of agent tasks that use a named workflow
- Current estimate: ~60% (most work goes through persistent-task or implement-and-verify)
- Target: 80%+

## Principles
1. If you do it twice, make it a workflow
2. Workflows should be discoverable (REGISTRY.md)
3. Measure workflow vs freestyle ratio
4. Retire workflows that aren't used

## Current Workflows (audit)

| Workflow | References | Status |
|----------|-----------|--------|
| verify-wrap | 539 | ✅ Keep — heavily used |
| growth-cycle | 85 | ✅ Keep — core coaching |
| parallel-research | 54 | ✅ Keep — active |
| implement-and-verify | 49 | ✅ Keep — code changes |
| implement-and-review | 49 | ✅ Keep |
| persistent-task | 36 | ✅ Keep — project engine |
| training-sprint | 29 | ✅ Keep |
| coaching-feedback | 4 | ❌ Dead — no workflow file |
| error-scan | 2 | ❌ Dead — no workflow file |
| auto-loop | 0 | ❌ Removed from disk |
| skill-lifecycle | 0 | ❌ Removed from disk |

Reference counts from codebase grep (iteration 1 findings).

## Next Actions
1. Remove dead workflow references from docs (coaching-feedback, error-scan)
2. Identify top freestyle pattern to convert into a workflow
3. Increase workflow coverage from ~60% toward 80%
