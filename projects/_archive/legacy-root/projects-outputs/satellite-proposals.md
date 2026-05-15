# Satellite Project Proposals — Phase 2
## Status: COMPLETE
## What I know so far
Phase 2 audit identified error-handling gaps and missing retry logic in workflow files. Two satellite projects proposed.
## My plan
1. Define Satellite 1: Error Resilience Hardening
2. Define Satellite 2: Workflow Retry & Circuit Breaker Integration
## Work output below

---

## Satellite 1: Error Resilience Hardening

### Goal
Add structured try/catch with graceful degradation to 5 high/medium-risk workflow files that currently lack error handling around critical operations.

### Success Metric
- Zero unhandled promise rejections under failure injection testing
- All 5 files have explicit error boundaries around LLM calls and file I/O
- Integration tests pass with simulated failures (timeout, malformed response, network error)

### Scope (Files)
| File | Risk Level | Current Issue |
|------|-----------|---------------|
| `workflows/master-worker-resilient.ts` | HIGH | Name implies resilience but error paths untested |
| `workflows/master-worker-cached.ts` | HIGH | Cache miss + LLM failure = unhandled crash |
| `workflows/metrics-collector.ts` | MEDIUM | File I/O without try/catch |
| `workflows/budget-checkpoint.ts` | MEDIUM | Budget exceeded path lacks graceful exit |
| `workflows/verify-wrap.ts` | MEDIUM | Verification failure crashes instead of returning error state |

### Estimated Effort
3-4 iterations (1 for scaffolding error patterns, 2-3 for implementation + tests)

### Dependencies
- Phase 1 integration test suite (already in place)
- test-gate.sh regression guard (already in place)

---

## Satellite 2: Workflow Retry & Circuit Breaker Integration

### Goal
Integrate the existing `circuit-breaker.ts` utility into LLM-calling workflows so that transient failures trigger retries with exponential backoff, and persistent failures trip a circuit breaker instead of crashing.

### Success Metric
- Simulated LLM timeout → 3 retries with backoff → graceful failure (not crash)
- Circuit breaker trips after 5 consecutive failures → fast-fail for 30s → half-open retry
- All retry/circuit-breaker behavior covered by integration tests

### Scope (Files)
| File | Integration Point |
|------|------------------|
| `workflows/master-worker-resilient.ts` | Worker prompt calls |
| `workflows/master-worker-cached.ts` | Cache-miss LLM calls |
| `workflows/implement-and-verify.ts` | Implementation + verification prompt calls |
| `workflows/circuit-breaker.ts` | Source utility (already exists) |

### Estimated Effort
4-5 iterations (1 for circuit-breaker API review, 2 for integration, 2 for testing)

### Dependencies
- Satellite 1 (error boundaries must exist before wrapping with retry logic)
- Existing `circuit-breaker.ts` utility

---

## Priority & Sequencing

**Recommended order**: Satellite 1 → Satellite 2 (sequential dependency)

**Total estimated effort**: 7-9 iterations

**Expected outcome**: System survives LLM provider outages, network blips, and malformed responses without crashing. All failure modes produce structured error states that upstream callers can handle.
