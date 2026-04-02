# Finding: isToolError() False Positive on Exit Code Content

**Date**: 2026-03-26T02:40Z  
**Type**: Bug Fix  
**Severity**: Medium (affects pivot heuristic and stuck detection)

## Problem

`isToolError()` in `src/lib/manager-utils.ts` used a broad regex to detect exit code errors:

```
/exit\s*(code\s*)?\d*[1-9]\d*/i
```

This matched "exit code 1" (or similar) **anywhere in the output text**, including:
- grep output containing source code that mentions exit codes
- read output of error logs or documentation
- bash output from commands that succeed but print content about exit codes

## Evidence

**Coder ERROR_LOG** (2026-03-26T01:08):
> FM-1.2: [PIVOT_SIGNAL_IGNORED?] Tool output shows a '⚠️ PIVOT REQUIRED' banner 
> after a grep command despite it succeeding; coder did not address/interpret this 
> system signal.

The coder ran a successful grep that happened to match content containing "exit code" patterns, 
which triggered `isToolError()` → which injected the PIVOT REQUIRED warning → which confused the coder.

## False Positive Examples

| Input | Old Result | Correct Result |
|-------|-----------|----------------|
| `"src/foo.ts:42: exit code 1;"` | TRUE ❌ | FALSE ✅ |
| `"the process will exit 1 if"` | TRUE ❌ | FALSE ✅ |
| `"testing that exit 42 is handled"` | TRUE ❌ | FALSE ✅ |

## Fix

Changed the regex to match only the exact format bash.ts appends:

```
/Command exited with code \d*[1-9]\d*/
```

This is the only format used by `src/lib/tools/bash.ts` (line 329):
```javascript
outputText += `\n\nCommand exited with code ${exitCode}`;
```

## Impact

- **Pivot heuristic** (manager-receipts.ts): No more false PIVOT REQUIRED warnings on successful greps
- **Stuck detector** (stuck-detector.ts): No more inflated error counts from grep/read content
- **Error tracking** (manager.ts): More accurate `is_error` classification

## Files Changed

- `src/lib/manager-utils.ts` — `isToolError()` regex tightened
- `test/tool-pivot.test.ts` — Updated test cases, added false-positive regression tests

## Test Results

All 87 tests pass (tool-pivot: 17, stuck-detector: 28, failure-chains: 42).
