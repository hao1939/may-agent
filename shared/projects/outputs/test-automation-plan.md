# Test Automation Plan

## Overview
Automated test execution strategy for the agent system, ensuring continuous validation of core workflows and agent behaviors.

## CI Pipeline Stages

### 1. Pre-commit (< 30s)
- TypeScript compilation check (`tsc --noEmit`)
- Lint critical files (workflow definitions, agent configs)
- Schema validation for project.md and config files

### 2. On-merge (< 5min)
- **Unit tests**: All pure functions in workflow logic
  - Circuit breaker state transitions
  - Budget checkpoint calculations
  - Request deduplication logic
- **Integration tests**: Agent-to-agent communication
  - Master dispatches task → worker receives it
  - Worker produces file → master verifies output
  - Fork/peek/cancel lifecycle

### 3. Scheduled (hourly)
- **End-to-end workflow tests**:
  - master-worker: full iteration cycle with real file output
  - budget-checkpoint: verify session cost tracking
  - circuit-breaker: verify failure counting and cooldown
- **Health checks**:
  - All 5 active projects have valid project.md
  - No zombie sessions (>2h with no progress)
  - Agent context files are parseable

## Coverage Thresholds
| Component | Current (est.) | Target | Timeline |
|-----------|---------------|--------|----------|
| Workflow logic | ~15% | 80% | 2 weeks |
| Agent handlers | ~10% | 60% | 3 weeks |
| Config/schema validation | ~5% | 90% | 1 week |
| E2E critical paths | ~20% | 70% | 4 weeks |

## Failure Alerting
- **P0 (immediate)**: Any E2E workflow test failure → blocks next deployment
- **P1 (within 1h)**: Unit test failure on merge → notify code owner
- **P2 (daily digest)**: Coverage regression > 5% → include in daily metrics snapshot

## Test File Conventions
```
tests/
  unit/
    workflows/        # Pure workflow logic tests
    agents/           # Agent handler tests
  integration/
    communication/    # Agent-to-agent tests
  e2e/
    workflows/        # Full workflow execution tests
  fixtures/
    projects/         # Mock project.md files
    sessions/         # Mock session data
```

## Implementation Priority
1. **Week 1**: Set up test runner (Vitest), write 5 unit tests for workflow logic
2. **Week 2**: Add integration tests for master-worker communication
3. **Week 3**: Build E2E test harness, automate hourly runs
4. **Week 4**: Add coverage reporting, enforce thresholds on merge
