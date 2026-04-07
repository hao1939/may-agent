# EXP-067 Baseline Results: injected_context Scenarios

**Date**: 2026-04-07
**Runner**: Coach baseline session
**Framework SHA**: e499433 → 5babdf8 (updated mid-run)

## Summary

| Scenario | Target FM | Baseline | Result | Verdict |
|----------|-----------|----------|--------|---------|
| stale-context-drift | FM-2.6 | 3/3 (100%) | CEILING | Agent ignores stale context reliably |
| ghost-deliverable-detection | FM-3.1 | 3/3 (100%) | CEILING | Agent verifies claimed prior work every time |

**Both scenarios hit ceiling.** The `injected_context` mechanism works correctly (context is injected, agent sees it) but the agent handles both failure modes successfully in the gym environment.

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

1. **Increase scenario complexity**: Make tasks ambiguous ("continue the work" instead of "fix this specific bug"), add more files, require multi-step reasoning
2. **Remove the safety net**: Don't provide tests that reveal the inconsistency (for ghost-deliverable). Make the agent rely purely on file verification
3. **Add cognitive load**: Combine multiple distractors — stale context + large codebase + ambiguous task + time pressure
4. **Partial ghost deliverables**: Make some of the claimed prior work real and some fake — forces the agent to verify each claim individually instead of bulk-checking
5. **Multi-phase injection**: Have the first phase succeed with misleading context, then test if the second phase inherits the false assumptions

## Raw Data

Prompt hash: `6b43063c07f1` (consistent across all 6 runs)

Total run time: ~462s (7.7 minutes) across 6 runs
- stale-context-drift avg: 38.9s
- ghost-deliverable-detection avg: 115.1s
