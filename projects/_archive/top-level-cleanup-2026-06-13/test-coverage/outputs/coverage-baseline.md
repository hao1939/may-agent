# Test Coverage Baseline

Generated: 2025-01-27

## Summary

| Category | Source Files | Test Files | Coverage |
|----------|-------------|------------|----------|
| Core system (shared/) | 30 | 7 | ~23% by file |
| Agent workflows | 14 | 0 | 0% |
| Guards | 11 | 0 | 0% |
| Evaluation | 5 | 5 | ~100% |
| Libraries | 2 | 0 | 0% |
| **Total (non-gym)** | **54** | **8** | **~15%** |

## Critical Untested Paths

### 1. Workflow Execution (HIGH PRIORITY)
Files with zero test coverage:
- `shared/workflows/master-worker.ts` — core orchestration loop
- `shared/workflows/implement-and-verify.ts` — worker execution flow
- `shared/workflows/project.ts` — project lifecycle management
- `shared/workflows/circuit-breaker.ts` — failure handling
- `shared/workflows/budget-checkpoint.ts` — cost controls
- `shared/workflows/verify-wrap.ts` — verification wrapper
- `shared/workflows/heartbeat-data.ts` — heartbeat data collection
- `shared/workflows/fewshot-inject-helpers.ts` — prompt injection
- `shared/workflows/project-helpers.ts` — project utilities

**Risk**: Workflow bugs cause silent failures, wasted iterations, and lost work. This is the #1 testing gap.

### 2. Guards (HIGH PRIORITY)
Files with zero test coverage:
- `shared/guards/finish-guard.ts`
- `shared/guards/hallucinated-path.ts`
- `shared/guards/auto-test.ts`
- `shared/guards/no-secret-leak.ts`
- `shared/guards/read-before-edit.ts`
- `shared/guards/verify-after-write.ts`
- `shared/guards/build-check.ts`
- `shared/guards/milestone-quality.ts`
- `shared/guards/cost-limit.ts`
- `shared/guards/loader.ts`
- `shared/guards/rbe-primer.ts` / `vae-primer.ts`

**Risk**: Guards are the safety net. Untested guards may silently pass bad output or block good output.

### 3. Agent SDK (MEDIUM PRIORITY)
- `shared/agent-sdk.ts` — no dedicated tests

### 4. Libraries (MEDIUM PRIORITY)
- `shared/lib/growth.ts` — no tests
- `shared/lib/project-health.ts` — no tests

## Well-Tested Areas

- **Evaluation system** (~100% file coverage): `context-learn.ts`, `evaluator.ts`, `failure-chain.ts`, `error-log.ts` all have corresponding test files in `shared/evaluation/test/`
- **Gym scenarios**: Each scenario has its own test files (not counted in system coverage)

## Recommended Test Priority

| Priority | Area | Files to Test | Impact |
|----------|------|---------------|--------|
| P0 | master-worker.ts | 1 | Core orchestration — most iterations flow through here |
| P0 | circuit-breaker.ts | 1 | Failure recovery — prevents cascade failures |
| P1 | Guards (loader + 3 critical) | 4 | Safety net for all agent output |
| P1 | project.ts + project-helpers.ts | 2 | Project lifecycle management |
| P2 | budget-checkpoint.ts | 1 | Cost controls |
| P2 | agent-sdk.ts | 1 | Agent interface layer |

## Target

- **Current**: ~15% file coverage, 0% on critical paths
- **Target**: 80%+ file coverage, 100% critical path coverage
- **Next milestone**: Write tests for top 5 critical untested paths
