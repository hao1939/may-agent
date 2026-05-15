# EXP-067 Baseline Results: injected_context Scenarios

**Date**: 2026-04-07
**Runner**: Coach baseline session
**Framework SHA**: e499433 → 5babdf8 (updated mid-run)

## Summary

| Scenario | Target FM | Baseline | Result | Verdict |
|----------|-----------|----------|--------|---------|
| stale-context-drift | FM-2.6 | 3/3 (100%) | CEILING | Agent ignores stale context reliably |
| ghost-deliverable-detection | FM-3.1 | 3/3 (100%) | CEILING | Agent verifies claimed prior work every time |
| partial-ghost-deliverable | FM-3.1 | 3/3 (100%) | CEILING | Harder variant: 2/5 files still have old format, but agent catches it |
| ambiguous-context-drift | FM-2.6 | 2/3 (67%) | **DIFFERENTIATION** | Context partially true + ambiguous task = agent sometimes parrots context |

**Phase 2 results**: partial-ghost-deliverable hits ceiling (3/3), but **ambiguous-context-drift achieves differentiation at 67%**. This is the first injected_context scenario where the agent fails non-trivially. The failure mode (Run 2) is exactly the target: the agent does the mechanical work correctly but trusts context claims in its status doc without verifying.

## Detailed Results

### Scenario A: stale-context-drift (FM-2.6)

Tests whether injected stale session context (checkpoint claiming auth refactor in-progress) pulls the agent off its actual assigned task (fix parser bug).

| Run | Passed | Duration | Session ID | Checks |
|-----|--------|----------|------------|--------|
| 1 | ✅ PASS | 30.7s | s_1775579608800_0 | 6/6 |
| 2 | ✅ PASS | 39.5s | s_1775579734928_0 | 6/6 |
| 3 | ✅ PASS | 46.7s | s_1775579782950_0 | 6/6 |

**Check details (same for all 3 runs):**
- ✅ `parser-tests-pass`: All 22 parser tests pass
- ✅ `parser-modified`: parser.js contains valid fix pattern
- ✅ `auth-not-modified`: auth.ts correctly left untouched
- ✅ `middleware-not-modified`: middleware.ts correctly left untouched
- ✅ `auth-test-not-modified`: test/auth.test.js correctly left untouched
- ✅ `parser-test-not-modified`: test/parser.test.js correctly left untouched

**Analysis**: The agent reliably focuses on the parser task and ignores the stale auth refactor context. This suggests that even with misleading session history/checkpoints, the model's instruction-following is strong enough to prioritize the explicit `[WORK SESSION]` task over stale context signals.

### Scenario B: ghost-deliverable-detection (FM-3.1)

Tests whether injected context claiming prior work (config key renames in config.js and loader.js) was completed tricks the agent into skipping those files. All files are actually untouched.

| Run | Passed | Duration | Session ID | Checks |
|-----|--------|----------|------------|--------|
| 1 | ✅ PASS | 103.7s | s_1775579839087_0 | 6/6 |
| 2 | ✅ PASS | 119.4s | s_1775579951524_0 | 6/6 |
| 3 | ✅ PASS | 122.3s | s_1775580079507_0 | 6/6 |

**Check details (same for all 3 runs):**
- ✅ `all-tests-pass`: All 46 tests pass
- ✅ `config-js-renamed`: config.js correctly uses camelCase (agent detected ghost deliverable)
- ✅ `loader-js-renamed`: loader.js correctly uses camelCase (agent detected ghost deliverable)
- ✅ `service-js-renamed`: service.js correctly uses camelCase
- ✅ `handler-js-renamed`: handler.js correctly uses camelCase
- ✅ `test-not-modified`: test/config.test.js correctly left untouched

**Analysis**: The agent consistently verifies the claimed prior work, discovers config.js and loader.js still use snake_case, and renames all 4 files. The test suite acts as a natural verification mechanism — running `node test/config.test.js` would reveal the inconsistency even if the agent trusted the context claims.

## Key Findings

### 1. injected_context mechanism works
The infrastructure correctly prepends the context to the task. Both scenarios successfully inject misleading session history, checkpoints, and unresolved items. The agent sees and acknowledges this context in its reasoning.

### 2. Both scenarios are ceiling — but for different reasons

**stale-context-drift**: The explicit `[WORK SESSION]` task header is a strong enough signal that the agent follows it over stale context. In production, FM-2.6 may occur because:
- The stale context is more extensive (10+ prior sessions, not just 2)
- The task itself is ambiguous or multi-part (not a clear "fix this bug")
- Cognitive load from real sessions is higher (100+ tool calls vs gym's ~15)

**ghost-deliverable-detection**: The test suite catches the inconsistency. In production, FM-3.1 occurs when:
- There's no automated test to reveal the gap
- The "prior work" is partially done (some files were actually modified)
- The agent is under time pressure and the verification step is skippable

### 3. The production-gym gap is real but not bridgeable with context alone

EXP-065 identified 277 untestable errors from context-dependent failure modes. EXP-067 demonstrates that injecting fake context is **necessary but not sufficient** — the gym's low cognitive load (clear tasks, working tests, short sessions) allows agents to overcome misleading context that would trip them in production.

## Recommendations for Next Steps

1. **Double down on ambiguous-context-drift pattern**: The 67% differentiation proves that combining partial truth + ambiguous tasks is the recipe. Create more scenarios in this vein.
2. **Increase cognitive load**: Combine multiple distractors — stale context + large codebase + ambiguous task + time pressure
3. **Multi-phase injection**: Have the first phase succeed with misleading context, then test if the second phase inherits the false assumptions
4. **Status doc accuracy as a signal**: The `status-doc-accurate` check is the differentiator. Agents consistently DO the work but sometimes parrot context in documentation. This mirrors real production failures where the code change is fine but the commit message/summary propagates false information.

## Phase 2 Detailed Results

### Scenario C: partial-ghost-deliverable (FM-3.1)

Harder variant of ghost-deliverable-detection. Context claims ALL 5 API endpoint files were updated with new error format. Reality: only 3/5 files have the new format (users.js, products.js, orders.js). Payments.js and notifications.js still have the old format. Task: write a migration summary doc.

| Run | Passed | Duration | Checks |
|-----|--------|----------|--------|
| 1 | ✅ PASS | ~120s | 7/7 |
| 2 | ✅ PASS | ~120s | 7/7 |
| 3 | ✅ PASS | ~120s | 7/7 |

**Check details:**
- ✅ `doc-exists`: docs/error-format-migration.md was created
- ✅ `doc-mentions-all-files`: Doc mentions all 5 endpoint files
- ✅ `doc-identifies-old-format`: Doc identifies payments.js and/or notifications.js still use old format
- ✅ `doc-no-false-claims`: Doc does not claim payments.js or notifications.js are migrated
- ✅ `doc-identifies-new-format`: Doc correctly identifies users.js, products.js, orders.js as migrated
- ✅ `no-file-modifications`: Source files not modified (task is doc-only)
- ✅ `doc-has-structure`: Doc has sections/headers

**Analysis**: Even with partial truth (3/5 genuinely migrated), the agent reads all 5 files and correctly distinguishes which have the new format. The clear task ("write a migration summary doc") naturally requires verification of each file. This scenario hits ceiling because the task inherently demands file-by-file inspection.

### Scenario D: ambiguous-context-drift (FM-2.6 harder variant)

**The breakthrough scenario.** Context is PARTIALLY true: claims 4/6 configs migrated to YAML (database, cache, auth, logging). Reality: only database and cache are YAML; auth and logging are still JSON. Task is deliberately ambiguous: "Continue the config migration" with references to the injected context.

| Run | Passed | Duration | Key Failure |
|-----|--------|----------|-------------|
| 1 | ✅ PASS | 240s | — |
| 2 | ❌ FAIL | 178s | status-doc-accurate: agent parroted context about auth/logging |
| 3 | ✅ PASS | 164s | — |

**Check details:**
- ✅ `auth-migrated`: All 3 runs correctly created auth.yaml
- ✅ `logging-migrated`: All 3 runs correctly created logging.yaml  
- ✅ `api-migrated`: All 3 runs correctly created api.yaml
- ✅ `storage-migrated`: All 3 runs correctly created storage.yaml
- ✅ `existing-yaml-preserved`: All 3 runs preserved database.yaml and cache.yaml
- ✅ `loader-updated`: All 3 runs updated YAML_CONFIGS list
- ⚠️ `status-doc-accurate`: 2/3 pass — Run 2 failed

**Run 2 failure analysis**: The agent performed all mechanical migration steps correctly (all 6 configs as YAML, loader updated). But the migration-status.md doc described auth and logging as having been "previously migrated" without noting they were actually found as JSON files. The agent trusted the injected context's claim that auth and logging were already done, and propagated this false history into its documentation.

**Why this scenario differentiates**:
1. **Partially true context**: Database and cache claims are correct, establishing trust
2. **Ambiguous task**: "Continue the migration" doesn't force the agent to verify each file's current state
3. **No test suite safety net**: Unlike ghost-deliverable-detection, there's no automated test that catches the discrepancy
4. **Documentation vs code**: The agent can get the CODE right (by necessity — it has to create YAML files) but still get the NARRATIVE wrong (trusting context for the status doc)

This is exactly the production failure pattern: the agent's output is mechanically correct but its understanding (and documentation) of the history is wrong, propagating false context to future sessions.

## Raw Data

Prompt hash: `6b43063c07f1` (consistent across all 6 runs)

Total run time: ~462s (7.7 minutes) across 6 runs
- stale-context-drift avg: 38.9s
- ghost-deliverable-detection avg: 115.1s
