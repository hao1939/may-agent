# Lessons Learned Synthesis

## Overview
Analysis of accumulated lessons from agent operations, categorized by type and distilled into actionable patterns for future work.

---

## Categorized Lessons

### Fixes (Bug/Error Learnings)

| # | Lesson | Context |
|---|--------|---------|
| 1 | manager.ts uses lazy DB init — must call getDb() not import db directly | Database access pattern |
| 2 | Vitest mock modules must be hoisted above imports with vi.hoisted() | Test setup |
| 3 | TypeScript enums can't be mocked directly — use string unions or const objects | Type mocking |
| 4 | Circuit breaker state resets need explicit timer cleanup to avoid test leaks | Resilience code |
| 5 | File watchers in tests must be closed or they hold the process open | Test cleanup |
| 6 | JSON.parse fails silently on trailing commas — always validate with try/catch | Data parsing |
| 7 | Process.exit in library code makes testing impossible — throw errors instead | Testability |
| 8 | Relative imports in test files resolve from the test file location, not project root | Path resolution |
| 9 | AbortController signals don't propagate through nested async calls automatically | Timeout handling |
| 10 | Mock timers interact badly with real async operations — pick one pattern per test | Async testing |

### Patterns (Reusable Approaches)

| # | Pattern | Application |
|---|---------|-------------|
| 1 | Write-first approach: produce output immediately, refine after | All deliverables |
| 2 | Test the sad path first — happy paths rarely break in production | Test strategy |
| 3 | Use factory functions for test data instead of shared mutable fixtures | Test architecture |
| 4 | One assertion per test when testing error conditions | Error path coverage |
| 5 | Regression baselines should be stored in code, not docs | CI/CD hardening |
| 6 | Mock at boundaries (HTTP, filesystem, DB), not internal functions | Mock strategy |
| 7 | Small focused iterations with verification beat large speculative changes | Workflow |
| 8 | Dashboard/visibility artifacts prevent repeated investigation work | Knowledge management |
| 9 | Check metrics BEFORE and AFTER changes to prove causation | Metric tracking |
| 10 | Wrap third-party APIs in thin adapters for testability | Architecture |

### Insights (System/Codebase Observations)

| # | Insight | Impact |
|---|---------|--------|
| 1 | workflow-runner.ts is the critical path — all execution flows through it | Priority testing |
| 2 | Budget and circuit-breaker are the resilience layer protecting against runaway costs | System safety |
| 3 | Test count is a leading indicator of system confidence | Metric selection |
| 4 | Most failures happen at integration boundaries, not in pure logic | Test focus |
| 5 | Projects stall when they lack a clear "done" definition | Project management |
| 6 | The agent system benefits more from hardening than new features at maturity | Lifecycle awareness |
| 7 | Satellite projects serve as forcing functions for cross-cutting improvements | Architecture |
| 8 | Memory/lessons systems only compound value if they're synthesized periodically | Knowledge ROI |
| 9 | Scripts that guard baselines prevent the "boiling frog" regression pattern | Quality protection |
| 10 | Single-page dashboards reduce decision latency more than detailed reports | Communication |

---

## Top 5 Actionable Patterns

### 1. Write-First, Verify-After
**Pattern**: Produce concrete output immediately rather than exploring/analyzing first. Refine based on feedback.
**Evidence**: 8/8 post-pivot iterations succeeded using this approach. Pre-exploration iterations had higher failure rates.
**Recommendation**: All agent tasks should produce a deliverable within the first 2 tool calls. Exploration comes after, not before.

### 2. Harden Before Extending
**Pattern**: Once metrics hit target, shift to protection (regression guards, integration tests, baselines) before adding new capabilities.
**Evidence**: Test count grew from ~1351 to 1414+ and stayed there because regression-check.sh prevents silent drops.
**Recommendation**: Every metric at target should have an automated guard within one iteration.

### 3. Test Boundaries, Not Internals
**Pattern**: Mock at system boundaries (HTTP, DB, filesystem). Test internal logic with real objects. This catches real bugs while keeping tests fast.
**Evidence**: Budget-checkpoint and circuit-breaker tests caught edge cases that unit tests of individual functions would miss.
**Recommendation**: Integration tests > unit tests for critical paths. Reserve mocks for I/O boundaries only.

### 4. Single-Source-of-Truth Dashboards
**Pattern**: Maintain one artifact that shows system state at a glance. Update it as the authoritative reference.
**Evidence**: system-health-dashboard.md eliminated repeated "what's the status?" investigation across sessions.
**Recommendation**: Every project cluster should have a dashboard. Update frequency: every 3-5 iterations.

### 5. Small Iterations With Immediate Verification
**Pattern**: Each task should be completable in one session with proof (test run, script execution, metric check).
**Evidence**: All successful iterations followed: produce → verify → report. Failed iterations attempted multi-step plans without intermediate verification.
**Recommendation**: Break any task larger than "write + run + confirm" into multiple iterations.

---

## Recommendations for System-Wide Adoption

1. **Codify the write-first constraint** in all agent task templates — it's the single highest-impact process improvement observed
2. **Add regression-check.sh to CI** — currently it exists but isn't automated on every push
3. **Schedule periodic lesson synthesis** (every 20 iterations) to prevent knowledge rot
4. **Prioritize resilience-layer tests** when onboarding new modules — budget/circuit-breaker patterns apply everywhere
5. **Use satellite projects as integration test targets** — they exercise cross-cutting concerns naturally

---

*Generated from analysis of agent operation lessons across 50+ sessions.*
