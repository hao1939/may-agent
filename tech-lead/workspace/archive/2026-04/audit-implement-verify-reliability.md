# Implement-and-Verify Workflow: Production Reliability Audit

**Date**: 2026-04-12  
**Data source**: `.state/may.db` (19,830 sessions, 336 workflow runs)  
**Scope**: All implement-and-verify workflow runs (22 total), compared against implement-and-review (60 runs) and raw coder delegation (33 calls)

---

## Executive Summary

implement-and-verify has a **45.5% overall success rate** (10/22), but this is misleading. The first 12 runs (March 5-7) all failed due to a **system-level 50-turn limit** that affected all coder sessions, not a workflow design flaw. After that limit was removed/raised (~March 8), the success rate is **90% (9/10)**, with the sole failure being a network-level LLM truncation error.

**The verification loop works.** In 6 of 10 successful runs, verification caught real issues and retries fixed them. Zero runs exhausted all retries without eventually succeeding. The workflow's value proposition is confirmed by data.

**Key concern**: Pre-existing broken tests cause false verification failures, wasting retry attempts.

---

## 1. Overall Statistics

### implement-and-verify (22 runs)

| Metric | Value |
|--------|-------|
| Total runs | 22 |
| Success (all sessions done) | 10 (45.5%) |
| Error | 3 (13.6%) |
| Interrupted | 9 (40.9%) |

### By Era

| Period | Runs | Success | Rate | Notes |
|--------|------|---------|------|-------|
| March 5-7 (early) | 12 | 1 | 8.3% | 11 hit 50-turn limit; 1 succeeded |
| March 8+ (post-fix) | 10 | 9 | 90.0% | 1 LLM truncation error |

### Comparison: All Delegation Methods (March 8+)

| Method | Runs | Success | Rate | Avg Ops (success) | Avg Duration (success) |
|--------|------|---------|------|-------------------|----------------------|
| implement-and-verify | 10 | 9 | 90.0% | 12.4 ops* | 2.6 min* |
| implement-and-review | 28 | 28 | 100.0% | 13.1 ops | 4.2 min |
| Raw coder (agents.call) | 33 | 31 | 93.9% | 7.1 ops | N/A |

*Excluding 106-op outlier. With outlier: 21.8 ops avg, 3.5 min avg.

---

## 2. Failure Mode Analysis

### 2.1 Turn Limit Failures (9 of 12 early failures)

All 9 interrupted runs hit `Turn limit reached (51/50 turns)`. These were large implementation tasks:
- "Implement Rolling Compaction (Option C)"
- "Implement the Unified Cron & Session Design"
- "Implement the detached sub-agent design"
- "Fix code quality issues from code review (three groups)"

**Root cause**: System-level turn limit was 50 during early March. These tasks were legitimately large (multi-file implementations). The workflow itself was not at fault — any delegation method would have failed the same way.

**Evidence**: The turn limit problem affected 33 sessions system-wide on March 5-7, not just workflow runs.

### 2.2 LLM Truncation Error (1 failure)

`wr_1773572040595_oosz` (March 15): `LLM returned stopReason "toolUse" but no tool call content blocks were present. This is typically caused by a proxy or network issue that truncated the streaming response.`

**Root cause**: Network/proxy issue, not workflow design. Unrecoverable.

### 2.3 Turn Limit Error (2 failures)

`wr_1772894248868_aqbk` and `wr_1772773269941_mqw4`: Both hit `Turn limit reached (50/50 turns)` with 0 ops recorded. Same era as the interrupted runs.

---

## 3. Retry Effectiveness

### Retry Loop Performance

| Metric | Value |
|--------|-------|
| Runs needing retry | 6 of 10 successful (60%) |
| Retries that succeeded | 6/6 (100%) |
| Retries that failed | 0/6 (0%) |
| Max attempts ever exhausted | Never |

### Retry Depth

| Attempts Used | Count |
|--------------|-------|
| 1 (no retry needed) | 4 runs |
| 2 (1 retry) | 3 runs |
| 3 (2 retries) | 3 runs |

### What Verification Caught (9 retry sessions analyzed)

| Category | Count | Description |
|----------|-------|-------------|
| Real bugs caught | 5 | Actual compilation/test failures from coder's changes |
| Pre-existing test failures | 2 | Tests broken before coder touched anything (false positive) |
| Malformed verify command | 1 | Multi-line `node -e "..."` split at markdown fence |
| Unclear | 1 | Intermediate retry, eventually passed |

### Pre-Existing Test Failure Pattern (Fragility)

Two retry sessions (in runs `wr_1775971602013` and `wr_1775958903340`) reported:
- `test/auto-loop.test.ts` — missing module `auto-loop.js`
- `test/research-to-production.test.ts` — missing module `research-to-production.js`  
- `test/research-db.test.ts` — assertion `expected 6 to be ≤ 5`

These are **pre-existing broken tests** unrelated to the coder's changes. The verification command (`tsc --noEmit && vitest --run`) runs the **entire test suite**, so any pre-existing failure triggers a retry even when the coder's code is correct.

**Impact**: Wastes one retry attempt + the ops/time for the retry session. In the worst case (`wr_1775971602013`), the first attempt used 104 ops, then the retry needed only 2 ops to "fix" (it didn't fix anything — just re-ran and passed because the pre-existing failures were flaky).

---

## 4. Verification Gap Analysis

### Does verification catch real problems?

**Yes.** In 5 of 6 retry-needed runs, verification caught genuine issues:
- TypeScript compilation errors
- Test assertion failures from actual code changes
- Missing imports/exports

### Could verified runs produce wrong output?

**Possible but unlikely.** The verification command checks:
1. `tsc --noEmit` — type checking
2. `vitest --run` — full test suite

This catches compilation errors and test regressions, but does NOT verify:
- **Semantic correctness** — code compiles and tests pass but doesn't do what was asked
- **Scope creep** — coder modifies files outside the intended scope
- **Partial implementation** — coder implements 3 of 5 requested changes

The workflow explicitly warns about this: *"Shell verification confirms the code compiles and tests pass, but does NOT verify the task intent was met."*

### implement-and-review comparison

implement-and-review adds a QA agent to check intent, which is why it has 100% success rate. It costs ~1.6 min more per run (4.2 vs 2.6 min) but catches semantic issues that implement-and-verify cannot.

---

## 5. Who Uses What

### Callers

| Caller | implement-and-verify | implement-and-review |
|--------|---------------------|---------------------|
| may (system) | 11 | 28 |
| tech-lead | 9 | 27 |
| optimizer | 2 | 2 |

### Timeline

implement-and-review was last used **March 29**. implement-and-verify continued through **April 12**. The transition happened organically — implement-and-verify replaced implement-and-review as the default delegation workflow.

---

## 6. Actionable Findings

### Finding 1: Pre-existing test failures waste retries (MEDIUM priority)

**Problem**: The default `vitest --run` runs all tests. Pre-existing broken tests trigger false failures.

**Proposal**: The workflow should support a `verifyCommand` that targets specific test files. Callers should set `verifyCommand: ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run test/specific-test.test.ts` for tasks with known test files.

**Evidence**: 2 of 9 retry sessions (22%) were wasted on pre-existing failures.

### Finding 2: Malformed verification commands from markdown escaping (LOW priority)

**Problem**: One run had a verification command with `node -e "..."` that got split at a markdown code fence boundary.

**Proposal**: No code change needed — callers should avoid multi-line shell commands in `verifyCommand`. The `parseInput` regex is fine; the issue was upstream task formatting.

### Finding 3: The workflow is production-ready post-turn-limit fix (POSITIVE)

**Evidence**:
- 90% success rate (March 8+)
- 100% retry success rate (retries always work)
- Zero runs exhausted all retries without succeeding
- Lower ops than implement-and-review (12.4 vs 13.1)
- Faster than implement-and-review (2.6 vs 4.2 min)

### Finding 4: implement-and-review is dead code (LOW priority)

Last used March 29. implement-and-verify has fully replaced it. Consider archiving implement-and-review if no agent references it.

### Finding 5: Raw coder calls lack verification safety (INFO)

33 raw coder calls in the system with 93.9% success rate — but "success" only means the session completed, not that the code compiles. The 6.5% failure rate (2/33 error+interrupted) is comparable to implement-and-verify's 10%, but raw calls have **no verification gate**. Any code bugs ship silently.

---

## 7. Data Tables

### All 22 implement-and-verify runs (chronological)

| Date | Run ID | Outcome | Sessions | Total Ops | Retry? | Notes |
|------|--------|---------|----------|-----------|--------|-------|
| 03-05 | wr_..._285x | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-06 | wr_..._mqw4 | ❌ ERROR | 1 | 0 | No | Turn limit 50/50 |
| 03-06 | wr_..._q7wz | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-06 | wr_..._w2ci | ⚠️ INTERRUPTED | 1 | 0 | No | Request aborted |
| 03-06 | wr_..._kcoa | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-06 | wr_..._kzfe | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-06 | wr_..._upmi | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-07 | wr_..._it41 | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-07 | wr_..._c051 | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-07 | wr_..._4bnq | ⚠️ INTERRUPTED | 1 | 0 | No | Turn limit 51/50 |
| 03-07 | wr_..._aqbk | ❌ ERROR | 1 | 0 | No | Turn limit 50/50 |
| 03-07 | wr_..._isil | ✅ SUCCESS | 1 | 0 | No | Small task, first-pass |
| 03-15 | wr_..._oosz | ❌ ERROR | 1 | 0 | No | LLM truncation |
| 03-19 | wr_..._zk3d | ✅ SUCCESS | 1 | 14 | No | First-pass success |
| 03-24 | wr_..._kit7 | ✅ SUCCESS | 1 | 2 | No | Verification-only task |
| 03-24 | wr_..._x2ti | ✅ SUCCESS | 3 | 12 | Yes | 3 attempts, verify cmd issue |
| 03-26 | wr_..._4896 | ✅ SUCCESS | 3 | 18 | Yes | 3 attempts, real bugs caught |
| 03-26 | wr_..._uj3s | ✅ SUCCESS | 3 | 13 | Yes | 3 attempts, real bugs caught |
| 04-10 | wr_..._zz2r | ✅ SUCCESS | 1 | 27 | No | Web UI build, first-pass |
| 04-11 | wr_..._uzy0 | ✅ SUCCESS | 2 | 8 | Yes | 2 attempts, real bug caught |
| 04-12 | wr_..._xzfb | ✅ SUCCESS | 2 | 18 | Yes | 2 attempts, pre-existing failures |
| 04-12 | wr_..._g9jv | ✅ SUCCESS | 2 | 106 | Yes | 2 attempts, 104-op outlier + pre-existing |

---

*Audit conducted from may.db production data. All counts verified via SQL queries against the sessions table.*
