# EXP-745 Phase 1 Results: Pattern Coverage Audit

**Date**: 2026-05-03  
**Status**: PHASE 1 COMPLETE  

## Methodology

Tested 20 representative worker task descriptions against `selectExamples()` in `fewshot-inject-helpers.ts`. Tasks span: implementation, bug-fix, refactoring, testing, deployment, investigation.

## Results

**Match rate: 9/20 (45%)** — NOT 0% as hypothesized.

The EXP-745 hypothesis (H2: "patterns are too narrow for typical production worker tasks") is **PARTIALLY CONFIRMED**. Patterns work well for bug-fix/error tasks but completely miss implementation, refactoring, deployment, and test-writing tasks.

### Matched Tasks (9/20)
| Task | Patterns Triggered |
|------|-------------------|
| Fix database migration failing on production | reproduce-first-debugging, evidence-over-narrative |
| Fix bug where login form shows 500 error | reproduce-first-debugging, evidence-over-narrative |
| Upgrade lodash v3→v4 across codebase | escalation-judgment |
| CI pipeline blocked on lint step | know-when-blocked |
| Add error handling to file upload | reproduce-first-debugging (false positive — "error" keyword) |
| Fix incorrect output in CSV export | evidence-over-narrative |
| Dependency conflict React 18 vs testing lib | escalation-judgment |
| Broken test crashes with TypeError | reproduce-first-debugging, evidence-over-narrative |
| Endpoint doesn't work correctly | evidence-over-narrative |

### Unmatched Task Categories (11/20)
| Category | Example Tasks | Count |
|----------|--------------|-------|
| Green-field implementation | "Implement auth flow", "Create REST endpoint", "Add pagination" | 4 |
| Refactoring | "Refactor payment module", "Refactor shared utils" | 2 |
| Test writing | "Write unit tests for middleware" | 1 |
| Documentation | "Update README" | 1 |
| Deployment/ops | "Deploy feature flags", "Add monitoring alerts" | 2 |
| Cleanup | "Clean unused imports" | 1 |

### Unwired Example Found
`requirements-conflict-analysis.md` exists in the examples directory but has NO corresponding entry in `EXAMPLE_PATTERNS`. Its trigger regex from the file header:
```regex
/contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off|can'?t.*satisfy.*both|infeasible|requirements.*tension|constraint.*violation/i
```

## Key Findings

1. **45% match rate** (not 0%) — patterns are functional for bug-fix domain
2. **False positives exist**: "Add error handling" matched `reproduce-first-debugging` due to `/error/i` keyword — this isn't a debugging task
3. **One example is unwired**: `requirements-conflict-analysis.md` should be added to EXAMPLE_PATTERNS
4. **Major gap**: No examples exist for implementation/refactoring tasks (55% of typical work)

## Phase 2 Recommendations

### Quick Fix (wire existing example)
Add `requirements-conflict-analysis` to EXAMPLE_PATTERNS:
```typescript
{ match: /contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off|can'?t.*satisfy.*both|infeasible|requirements.*tension|constraint.*violation/i, file: "requirements-conflict-analysis" },
```

### Pattern Expansion Candidates
1. **Refactoring pattern**: `/refactor|restructure|extract.*into|split.*into|move.*to|reorganize/i` → new example needed
2. **Implementation pattern**: `/implement|create.*endpoint|add.*feature|build.*service|set up/i` → new example needed  
3. **Tighten false positives**: Change `error` pattern from `/error/i` to `/error.*message|error.*handling/` would over-restrict. Better: accept the false positive — the debugging example is still useful context for error-handling tasks.

### New Examples Needed (Phase 2 work)
- **Incremental implementation**: How to approach a new feature (read existing code → plan → implement → verify)
- **Safe refactoring**: How to refactor without breaking things (tests first → small moves → verify)

## Revised Match Rate Estimate
- With unwired example added: 45% → ~47% (catches some conflict tasks)
- With new refactoring pattern + example: ~47% → ~57%
- With new implementation pattern + example: ~57% → ~75%

## Decision
Proceed to Phase 2: Wire `requirements-conflict-analysis`, write 1-2 new examples for implementation/refactoring domains, then validate in gym.
