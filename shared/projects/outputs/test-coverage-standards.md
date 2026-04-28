# Coverage Standards & Gates

## Coverage Thresholds

| Scope | Minimum | Target | Enforced |
|-------|---------|--------|----------|
| Overall line coverage | 60% | 80% | CI gate |
| Critical path coverage | 90% | 100% | CI gate |
| New code (per PR) | 80% | 90% | PR check |
| Branch coverage | 50% | 70% | Warning only |

## Critical Path Definition

Code is "critical path" if it handles:
1. **Workflow execution** — master-worker dispatch, step sequencing, error recovery
2. **Request tracking** — creation, status updates, completion/failure marking
3. **Agent dispatch** — session creation, task delivery, result collection
4. **File I/O** — checkpoint read/write, project file management
5. **State transitions** — project status changes, milestone completion

All critical paths must have ≥90% line coverage and ≥80% branch coverage.

## CI Gate Configuration

```yaml
# vitest.config.ts coverage settings
coverage:
  provider: v8
  thresholds:
    lines: 60
    branches: 50
    functions: 60
    statements: 60
  thresholdAutoUpdate: false
  reporter:
    - text
    - json-summary
    - lcov
```

### Gate Behavior
- **Below minimum**: Build fails, PR cannot merge
- **Below target but above minimum**: Warning in PR comment, merge allowed
- **New files with 0% coverage**: Flagged for review

## Standards for New Code

### Required
1. Every new exported function must have at least one test
2. Error paths must be tested (not just happy path)
3. Integration tests for any new workflow step or agent interaction
4. Mock external dependencies; don't mock the unit under test

### Recommended
1. Test file mirrors source file: `src/foo.ts` → `src/foo.test.ts`
2. Use descriptive test names: `it("rejects dispatch when agent is busy")`
3. Group related tests with `describe()` blocks
4. Aim for <100ms per unit test; <5s per integration test

## Coverage Reporting

### Daily
- Auto-generated coverage summary in project outputs
- Delta from previous day highlighted

### Weekly
- Full coverage report with trend graph
- Untested critical paths flagged for next sprint

## Exemptions

Files that may be excluded from coverage requirements:
- `*.d.ts` (type definitions)
- `*/generated/*` (auto-generated code)
- Test utilities and fixtures
- CLI entry points (tested via integration tests instead)

Exemptions must be documented in `vitest.config.ts` with a comment explaining why.
