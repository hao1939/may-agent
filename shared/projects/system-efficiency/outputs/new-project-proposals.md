# New Satellite Project Proposals

_Generated from source analysis of `/app/agents/shared/workflows/` (5,651 LOC across 20+ modules)_

---

## 1. Workflow Consolidation

**Problem**: There are 4 variants of master-worker (`master-worker.ts` 650 LOC, `master-worker-resilient.ts` 285 LOC, `master-worker-cached.ts`, `master-worker-with-health-check.ts` 213 LOC). This creates maintenance burden and confusion about which to use.

**Goal**: Consolidate into a single configurable `master-worker.ts` with optional resilience, caching, and health-check behaviors via options object.

**Metrics**:
- Reduce from 4 files to 1 (+ backwards-compat re-exports)
- Total LOC reduction: target 30%+
- Zero test regressions (1438+ tests still pass)

**First milestone**: Map the API surface of all 4 variants. Identify shared vs. unique logic. Write an RFC with the unified API.

**Value**: Reduces cognitive load, eliminates divergent bug fixes, makes the system easier to extend.

---

## 2. Test Coverage Gaps — Integration Layer

**Problem**: While unit test count is high (1438), several critical modules have no integration-level testing. The `workflow-runner.ts` (236 LOC) and `project.ts` (1159 LOC — the largest file) orchestrate complex multi-step flows but tests only cover individual helpers.

**Goal**: Add integration tests that exercise full workflow execution paths end-to-end with mocked LLM responses.

**Metrics**:
- Add 30+ integration tests in a new `tests/integration/` directory
- Cover: project creation → iteration → checkpoint → completion flow
- Cover: workflow-runner dispatch → verify → retry flow
- Target: 1500+ total tests

**First milestone**: Write 10 integration tests for `workflow-runner.ts` covering happy path, timeout, and retry scenarios.

**Value**: Catches regressions that unit tests miss — especially around state transitions and error propagation between modules.

---

## 3. Dead Code & Export Hygiene

**Problem**: With 20+ workflow modules, it's unclear which exports are actually consumed by agents vs. which are dead code from earlier iterations. No tooling enforces this.

**Goal**: Build an import-graph analyzer that identifies unused exports, circular dependencies, and modules that could be tree-shaken.

**Metrics**:
- Produce a dependency graph of all workflow modules
- Identify and remove 10%+ dead exports
- Zero circular dependencies
- Add a CI check that fails on unused exports

**First milestone**: Run `ts-prune` or equivalent on the workflows directory. Catalog all unused exports in a report.

**Value**: Smaller surface area = fewer bugs, faster builds, easier onboarding for new agents/developers.

---

## Recommendation

**Start with #1 (Workflow Consolidation)** — it has the highest compound value. Every future change to master-worker logic currently requires updating 4 files. Consolidation makes #2 easier (fewer code paths to integration-test) and #3 partially redundant (consolidation eliminates dead variants).

**Estimated effort**: 3-4 iterations for the RFC + implementation + migration.
