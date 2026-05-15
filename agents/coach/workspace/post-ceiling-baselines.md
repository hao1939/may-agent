# Post-Ceiling Scenario Baselines

**Date**: 2026-04-10
**Agent**: coder (may-agent adapter)
**Framework SHA**: e3f53b5
**Purpose**: Establish baselines for 3 new "harder" scenarios designed to break the gym ceiling.

## Summary

| Scenario | Pass Rate | Avg Duration | Checks | Result |
|----------|-----------|-------------|--------|--------|
| skill-conflict-partial-fix | 3/3 (100%) | 160s | 7/7 all reps | **CEILING** |
| triage-under-uncertainty | 3/3 (100%) | 178s | 8/8 all reps | **CEILING** |
| ghost-dependency-debug | 3/3 (100%) | 72s | 7/7 all reps | **CEILING** |

**Overall: 9/9 runs passed (100%). All scenarios are at ceiling.**

## Detailed Results

### 1. skill-conflict-partial-fix

**Design intent**: Test skill interference — the correct bug fix causes a test to fail because the test relied on the buggy behavior. Agent must recognize the test encodes the wrong expectation and update it, not revert the fix.

| Rep | Passed | Checks | Duration | Summary |
|-----|--------|--------|----------|---------|
| 1 | ✅ | 7/7 | 205s | Fixed bug, recognized test was wrong, updated test with explanation |
| 2 | ✅ | 7/7 | 140s | Fixed bug, recognized test was wrong, updated test with explanation |
| 3 | ✅ | 7/7 | 133s | Fixed bug, recognized test was wrong, updated test with explanation |

**Check details (consistent across all reps)**:
- ✅ bankers-rounding-implemented — Correct rounding behavior
- ✅ fix-not-reverted — Agent didn't cave to test pressure
- ✅ all-tests-pass — 15/15 tests pass after fix + test update
- ✅ promotional-test-updated — Test corrected to match correct behavior
- ✅ fix-notes-exist — FIX_NOTES.md written
- ✅ explains-test-change-reasoning — Explained why test needed updating
- ✅ no-hack-fix — Clean implementation, not a workaround

**Assessment**: The agent consistently recognizes that the failing test is wrong, not the fix. The skill-interference trap doesn't work — the agent's evidence-over-narrative behavior already handles this case.

### 2. triage-under-uncertainty

**Design intent**: Three bugs of different complexity/impact. Tests strategic prioritization and knowing when NOT to fix something.

| Rep | Passed | Checks | Duration | Summary |
|-----|--------|--------|----------|---------|
| 1 | ✅ | 8/8 | 208s | Perfect triage — documented all bugs, correct priorities, fixed what matters |
| 2 | ✅ | 8/8 | 166s | Perfect triage — documented all bugs, correct priorities, fixed what matters |
| 3 | ✅ | 8/8 | 161s | Perfect triage — documented all bugs, correct priorities, fixed what matters |

**Check details (consistent across all reps)**:
- ✅ triage-document-exists — TRIAGE.md written (4-5KB)
- ✅ acknowledges-all-bugs — All 3 bugs identified
- ✅ explains-priority-reasoning — 5-7/7 reasoning patterns found
- ✅ date-bug-fixed — Easy fix completed
- ✅ account-race-addressed — High-impact race condition fixed
- ✅ recognized-search-complexity — Correctly identified search as architectural issue
- ✅ search-not-made-worse — Didn't break search trying to fix it
- ✅ correct-priority-assessment — Bug 102 (accounts) identified as highest priority

**Assessment**: The agent handles triage naturally — it prioritizes by impact, fixes what it can, documents what it can't, and avoids making things worse. No ambiguity-induced errors.

### 3. ghost-dependency-debug

**Design intent**: Misleading stack trace points at module A, but root cause is initialization order in module B. Tests debugging depth.

| Rep | Passed | Checks | Duration | Summary |
|-----|--------|--------|----------|---------|
| 1 | ✅ | 7/7 | 67s | Root cause identified and fixed with full explanation |
| 2 | ✅ | 7/7 | 66s | Root cause identified and fixed with full explanation |
| 3 | ✅ | 7/7 | 82s | Root cause identified and fixed with full explanation |

**Check details (consistent across all reps)**:
- ✅ tests-pass — All tests pass after fix
- ✅ plugins-registered — All plugins properly registered
- ✅ root-cause-documented — ROOT_CAUSE.md written (2.7-3.3KB)
- ✅ identifies-init-order — 5-7/7 init-order indicators found
- ✅ fix-not-in-validator — No bandaid fix in the misleading location
- ✅ explains-misleading-error — Explained why the stack trace was misleading
- ✅ root-cause-fix-location — Fix correctly applied in app.js init order

**Assessment**: The agent is extremely fast at this (67-82s) and consistently traces past the misleading error to the real root cause. This is a strong debugging skill that isn't challenged by the indirection level in this scenario.

## Implications

All 3 "post-ceiling" scenarios are at ceiling (100%, 9/9). This means:

1. **The coder agent's current skill stack handles these failure modes already.** Skill interference, triage judgment, and root-cause debugging through indirection are within its capabilities.

2. **The scenarios need to be significantly harder to break ceiling.** Possible approaches:
   - **Multi-file cascading bugs** where fixing one reveals another (chain depth > 2)
   - **Ambiguous requirements** where the "correct" fix is genuinely debatable
   - **Time-pressure scenarios** with strict step limits forcing prioritization tradeoffs
   - **Adversarial setups** where environment signals actively mislead (not just one misleading stack trace)
   - **Production-scale codebases** where the agent must navigate 20+ files to find the relevant code
   - **Scenarios requiring external knowledge** the agent doesn't have in its skill set

3. **The gym may have reached a fundamental limit.** Single-session coding/debugging tasks with < 10 files may simply be within the agent's core capability regardless of scenario design. Breaking through may require:
   - Much larger codebases (50+ files)
   - Multi-session scenarios with information loss between sessions
   - Tasks that require genuine creativity, not just analysis
   - Scenarios where the correct approach conflicts with the agent's training distribution

## Session IDs (for replay)

| Scenario | Rep | Session ID |
|----------|-----|-----------|
| skill-conflict-partial-fix | 1 | s_1775784304885_0 |
| skill-conflict-partial-fix | 2 | s_1775784544339_0 |
| skill-conflict-partial-fix | 3 | s_1775784694276_0 |
| triage-under-uncertainty | 1 | s_1775784846945_0 |
| triage-under-uncertainty | 2 | s_1775785061737_0 |
| triage-under-uncertainty | 3 | s_1775785234279_0 |
| ghost-dependency-debug | 1 | s_1775785409467_0 |
| ghost-dependency-debug | 2 | s_1775785483305_0 |
| ghost-dependency-debug | 3 | s_1775785557493_0 |
