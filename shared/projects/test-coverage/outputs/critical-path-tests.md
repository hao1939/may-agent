# Critical Path Tests — Milestone 2 Deliverable

Date: 2025-01-27

## Existing Test Coverage

8 test files found (excluding node_modules):
- `shared/evaluation/test/context-learn.test.ts`
- `shared/evaluation/test/evaluator-failure-chain.test.ts`
- `shared/evaluation/test/agent-scores.test.ts`
- `shared/evaluation/test/error-log-schema.test.ts`
- `shared/evaluation/test/failure-chains.test.ts`
- `shared/evaluation/test/evaluator-isolated-transcript.test.ts`
- `shared/evaluation/test/evaluate-task.test.ts`
- `test/gym/gym.test.ts`

**All 8 tests cover evaluation logic only.** Zero tests for workflows, request tracking, or agent dispatch.

## Top 5 Untested Critical Paths

| # | Path | File(s) | Risk | Priority |
|---|------|---------|------|----------|
| 1 | **Master-Worker Workflow** | `shared/workflows/master-worker.ts` | Core execution loop — failures cascade to all projects | P0 |
| 2 | **Circuit Breaker** | `shared/workflows/circuit-breaker.ts` | Prevents runaway failures; untested = silent bypass | P0 |
| 3 | **Project Lifecycle** | `shared/workflows/project.ts`, `project-helpers.ts` | Project creation/archival; bugs = zombie projects | P1 |
| 4 | **Budget Checkpoint** | `shared/workflows/budget-checkpoint.ts` | Cost control; untested = potential runaway spend | P1 |
| 5 | **Heartbeat Data** | `shared/workflows/heartbeat-data.ts` | Agent health signals; bad data = missed failures | P2 |

## Recommended Test Stubs

### 1. master-worker.test.ts
```typescript
import { describe, it, expect } from 'vitest';

describe('master-worker workflow', () => {
  it('should reject worker iterations with zero file writes', () => {
    // Verify output-verification logic added in iteration 8
  });

  it('should pass task context from master to worker', () => {
    // Verify task string reaches worker agent
  });

  it('should timeout workers that exceed budget', () => {
    // Verify budget-checkpoint integration
  });
});
```

### 2. circuit-breaker.test.ts
```typescript
import { describe, it, expect } from 'vitest';

describe('circuit breaker', () => {
  it('should trip after N consecutive failures', () => {
    // Verify threshold triggers circuit open
  });

  it('should allow retry after cooldown period', () => {
    // Verify half-open state
  });

  it('should reset on successful execution', () => {
    // Verify closed state restoration
  });
});
```

### 3. project-lifecycle.test.ts
```typescript
import { describe, it, expect } from 'vitest';

describe('project lifecycle', () => {
  it('should archive projects with 500+ consecutive skips', () => {
    // Verify zombie detection
  });

  it('should track iteration count per project', () => {
    // Verify metrics collection
  });
});
```

### 4. budget-checkpoint.test.ts
```typescript
import { describe, it, expect } from 'vitest';

describe('budget checkpoint', () => {
  it('should halt execution when budget exceeded', () => {
    // Verify cost limit enforcement
  });

  it('should log budget warnings at 80% threshold', () => {
    // Verify early warning
  });
});
```

### 5. heartbeat-data.test.ts
```typescript
import { describe, it, expect } from 'vitest';

describe('heartbeat data', () => {
  it('should return valid agent status for active agents', () => {
    // Verify data structure
  });

  it('should detect stale agents with no recent activity', () => {
    // Verify staleness detection
  });
});
```

## Coverage Gap Summary

- **Evaluated code**: ~7 files (all in `shared/evaluation/`)
- **Untested critical code**: 10+ workflow files, all dispatch logic, all request tracking
- **Estimated current coverage of critical paths**: ~0%
- **After implementing above 5 test suites**: ~40-50% of critical paths covered

## Next Steps (Milestone 3)
- Implement these test stubs as real tests
- Add coverage threshold (60% minimum) to build process
- Document coverage standards in `outputs/coverage-standards.md`
