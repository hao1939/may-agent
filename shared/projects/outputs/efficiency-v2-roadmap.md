# System Efficiency v2 — Resilience & Performance Roadmap

## Phase 2 Goals

Reduce wasted iterations caused by crashes, unhandled errors, and lost state. Phase 1 achieved all 3 primary metrics; Phase 2 protects those gains and improves iteration efficiency by targeting the 3 failure modes identified in the error-recovery audit.

**Target outcomes:**
- Zero lost deliverables from mid-iteration crashes
- Automatic retry for transient provider errors
- Sub-60s iteration startup via cached state

---

## Priority 1: Mid-Iteration Crash Recovery

**Problem:** When a worker crashes mid-task (OOM, timeout, provider disconnect), all progress since last checkpoint is lost. No automatic resume mechanism exists.

**Implementation Plan:**
1. Add incremental checkpointing every N tool calls (not just at task boundaries)
2. Store checkpoint data in `.state/checkpoints/<sessionId>-<stepN>.json`
3. On session start, check for incomplete checkpoints and offer resume
4. Add a `resume` flag to worker dispatch that replays from last checkpoint

**Files to modify:**
- `agents/shared/workflows/master-worker.ts` — add checkpoint frequency config
- `agents/shared/workflows/project.ts` — add resume detection on iteration start
- Worker agent logic — emit checkpoint after each significant tool call

**Effort:** 2-3 iterations
**Expected impact:** Eliminate ~30% of wasted iterations

---

## Priority 2: Provider Error Retry with Exponential Backoff

**Problem:** API/provider errors (rate limits, 503s, timeouts) cause immediate task failure. No retry logic exists in the workflow orchestration layer.

**Implementation Plan:**
1. Wrap all LLM calls in a retry utility with exponential backoff (1s, 2s, 4s, max 3 retries)
2. Distinguish retryable errors (429, 503, timeout) from fatal errors (400, auth)
3. Log retry attempts to session state for observability
4. Add circuit-breaker integration (reference: `agents/shared/workflows/circuit-breaker.ts`)

**Files to modify:**
- Create `agents/shared/workflows/retry.ts` — generic retry utility
- `agents/shared/workflows/master-worker.ts` — wrap dispatch calls
- `agents/shared/workflows/circuit-breaker.ts` — integrate with retry counts

**Effort:** 1-2 iterations
**Expected impact:** Recover from ~50% of transient failures automatically

---

## Priority 3: State Persistence on Graceful Shutdown

**Problem:** When sessions end (timeout, budget exhaustion), in-flight state (partial results, decision context) is not persisted. Next iteration starts cold.

**Implementation Plan:**
1. Register shutdown hooks that serialize current task state to `.state/sessions/<id>-final.json`
2. Include: current step, partial results, files modified so far, decisions made
3. On next iteration start, load previous session's final state as context
4. Add `budget-checkpoint.ts` integration to trigger early persistence when budget is low

**Files to modify:**
- `agents/shared/workflows/project.ts` — add shutdown hook registration
- `agents/shared/workflows/budget-checkpoint.ts` — trigger state save at 80% budget
- Create `agents/shared/workflows/session-state.ts` — serialization/deserialization

**Effort:** 2 iterations
**Expected impact:** Reduce cold-start context loss, save ~15min of re-discovery per iteration

---

## Latency Profiling Plan

**What to measure:**
| Metric | How to instrument | Target |
|--------|-------------------|--------|
| Iteration startup time | Timestamp from session create → first tool call | < 30s |
| Context loading time | Time spent reading checkpoints/state files | < 5s |
| Tool call round-trip | Timestamp each tool invocation | < 10s avg |
| Total iteration wall time | Session start → finish() call | < 5min for simple tasks |

**Instrumentation approach:**
1. Add timing wrappers around key workflow stages
2. Log to `.state/metrics/latency-<date>.json`
3. Create `scripts/latency-report.sh` to aggregate and display trends

**Target improvements:**
- 40% reduction in startup time via warm state loading
- 20% reduction in total iteration time via fewer retries/crashes

---

## Success Criteria

Phase 2 is complete when:
- [ ] Mid-iteration crash recovery works (test: kill worker mid-task, verify resume produces deliverable)
- [ ] Provider errors retry automatically (test: simulate 503, verify task completes)
- [ ] Graceful shutdown persists state (test: budget timeout saves state, next iteration loads it)
- [ ] Latency profiling produces at least one snapshot report
- [ ] Zero wasted iterations over a 10-iteration span

---

## Timeline Estimate

| Priority | Effort | Dependency |
|----------|--------|------------|
| P1: Crash recovery | 2-3 iterations | None |
| P2: Retry logic | 1-2 iterations | None (parallel with P1) |
| P3: Shutdown persistence | 2 iterations | After P1 (uses same checkpoint infra) |
| Latency profiling | 1 iteration | After P1-P3 (measures improvement) |

**Total estimated effort:** 5-7 iterations to full Phase 2 completion.
