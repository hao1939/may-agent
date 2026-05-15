# Finding: Coder 104-op Outlier — Fewshot Injection False Positive

**Date**: 2026-04-12  
**Session**: s_1775971602013_1886  
**Severity**: Medium (single incident, ~$1-3 waste, concrete fix available)

## Summary

A coder session hit 104 ops (vs avg 10.5 for coder) and produced **zero useful changes**. Root cause: the fewshot injection system matched `.bin` in `./node_modules/.bin/tsc` and injected an irrelevant "binary file escalation" example, confusing the coder into spending 104 ops on a task about removing dead evaluation code.

## Timeline

1. **Tech-lead** (s_1775971448515_1880, 28 ops) analyzed dead evaluation code for "Lens C" work
2. Tech-lead called `implement-and-verify` workflow with a task to remove 6 dead functions from evaluator.ts
3. **Fewshot injector** matched `.bin` in `./node_modules/.bin/tsc --noEmit` (the verification command) → injected `binary-file-escalation.md` example
4. Also matched `consumer` (in "ONLY consumer is computeHeuristicScores") → injected `escalation-judgment.md` example
5. **Coder** (s_1775971602013_1886) received task starting with "## Reference: How a similar task was handled" about **recognizing binary files as impossible tasks**
6. Coder spent 104 ops / 10.3 minutes, ended with "No changes to the protected files. Everything is clean."
7. **Retry** (s_1775972235171_1889, 2 ops) got "Fix Required (attempt 2/2)" but tests failed due to pre-existing issues
8. **Total tree cost: 134 ops** (28 TL + 104 coder + 2 retry) for zero useful output

## Root Cause: Fewshot Pattern False Positive

The regex pattern in `agents/shared/workflows/fewshot-inject-helpers.ts`:

```javascript
{ match: /binary|\.bin|compiled|executable|hexdump/i, file: "binary-file-escalation" }
```

Matches `.bin` in the common path `./node_modules/.bin/tsc`. Every task that includes a verifyCommand referencing `./node_modules/.bin/` will incorrectly trigger the binary file escalation example.

## Why 104 Ops?

The coder's digest shows:
- **Step 2 (checkpoint)**: "Analyzed all files. Ready to make edits." — identified 6 dead functions to remove
- **Step 3 (end)**: "No changes to the protected files. Everything is clean."

Between analysis and conclusion, the coder spent ~104 ops. The binary file escalation example likely created confusion — the example teaches "stop immediately and report blocked when facing binary files" but the actual task was straightforward code deletion. The coder may have oscillated between:
- Attempting edits (the actual task)
- Self-doubt from the injected example suggesting the task might be "impossible"
- Repeated read/edit cycles that failed or were reverted
- Eventually giving up with a misleading "everything is clean" outcome

The 10.1 ops/min rate (vs typical 4-6) suggests rapid fire edit attempts that kept failing.

## Impact Assessment

- **This incident**: ~134 ops wasted (28 TL + 104 coder + 2 retry)
- **Frequency**: Only 1 coder session >75 ops in 14 days (besides gym runs), so likely one-off
- **Systemic risk**: Any future implement-and-verify task with `./node_modules/.bin/` in verifyCommand will trigger the same false positive. Since DEFAULT_VERIFY = `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest --run`, this could affect many tasks — but only if the task text also reaches the fewshot injector (which it does for attempt 1)

## Recommended Fix

### High priority: Fix the regex pattern

```javascript
// Before:
{ match: /binary|\.bin|compiled|executable|hexdump/i, file: "binary-file-escalation" }

// After (negative lookahead excludes .bin/ paths):
{ match: /binary|\.bin(?![/\\])|compiled|executable|hexdump/i, file: "binary-file-escalation" }
```

This preserves matching `data-processor.bin` (file extension) while excluding `./node_modules/.bin/tsc` (directory path).

### Medium priority: Strip verifyCommand before fewshot matching

The fewshot injector shouldn't match on the verification command metadata — only on the actual task description. In `injectFewShot()`, strip the verifyCommand line before running `selectExamples()`:

```javascript
const taskForMatching = task.replace(/^verifyCommand:\s*.+$/m, "");
const selected = selectExamples(taskForMatching);
```

### Low priority: Fix `consumer` false positive

The `upgrade` pattern matches `consumer` which appears in normal code descriptions ("only consumer is X"). Consider requiring `consumer` to be near `import` or `dependency` context, or removing it from the pattern.

## Evidence

| Metric | Value |
|--------|-------|
| Session | s_1775971602013_1886 |
| Parent | s_1775971448515_1880 (tech-lead, 28 ops) |
| Agent | coder |
| Ops | 104 (10.3 min) |
| Outcome | "No changes to the protected files. Everything is clean." |
| Files changed | 0 |
| Fewshot trigger | `.bin` in `./node_modules/.bin/tsc` |
| Pattern | `/binary|\.bin|compiled|executable|hexdump/i` |
| Coder avg (14d) | 10.5 ops |
| Coder p95 (excl this) | ~27 ops |
