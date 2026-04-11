# EXP-132 Results: Path Hallucination Guard for C7.1

**Status**: DEPLOYED  
**Date**: 2026-04-11  
**Implementation**: `src/lib/tools/path-hallucination-guard.ts`  
**Tests**: `src/lib/tools/path-hallucination-guard.test.ts`  

## Implementation Summary

Built a `beforeToolCall` guard that intercepts `bash()` calls containing hallucinated filesystem paths (`/home/`, `/Users/`, `/root/`, `~/`). This is a Channel 2 (forced externalization) intervention — the agent physically cannot execute commands with non-existent paths.

### Detection Patterns
- `/home/` — Linux home directories (don't exist in container)
- `/Users/` — macOS home directories (don't exist in container)
- `/root/` — root home directory (doesn't exist in container)
- `~/` — tilde expansion at word boundary

### False Positive Exclusions
Commands where the hallucinated path is a search pattern, not a filesystem access:
- **Search commands**: grep, rg, ag, ack, echo, printf, sed
- **Inline scripts**: `bun -e`, `node -e`, `python -c`, `deno eval` — path appears as string literal in code

### Block Message
```
🚫 PATH_HALLUCINATION: This command references a path that doesn't exist in this environment:
  Detected: /home/hao/may-agent

The project root is /app. There are no /home/, /Users/, or /root/ directories.
Rewrite your command using /app as the base path.
  Example: cd /app && git status
  Example: cat /app/src/lib/manager.ts
```

## Integration

Wired into `composeGuards()` in `src/lib/manager.ts`, positioned 3rd in the chain (after empty-args-guard and tool-schema-guard, before completeness-guard). The import and guard call were already present in manager.ts from the design phase.

## Test Results

**41 tests, 0 failures, 65 assertions**

| Category | Tests | Status |
|----------|-------|--------|
| Non-bash tools pass through | 2 | ✅ |
| Clean bash commands pass through | 7 | ✅ |
| Block /home/ paths | 4 | ✅ |
| Block /Users/ paths | 2 | ✅ |
| Block /root/ paths | 2 | ✅ |
| Block ~/ paths | 4 | ✅ |
| Allow search commands (grep/rg/ag/echo/printf/sed) | 8 | ✅ |
| Allow inline scripts (bun -e/node -e/python -c) | 5 | ✅ |
| Error message quality | 2 | ✅ |
| Edge cases (missing args, non-string, multiline, pipeline, heredoc) | 5 | ✅ |

## Design Decisions

1. **Err on blocking**: False positive cost is low (agent retries with /app), false negative cost is high (C7.1 failure). So we block aggressively.
2. **Fail-open**: If detection logic throws, allow the call through (FAIL-OPEN policy).
3. **Fast path**: Substring check before regex — most commands have no hallucinated paths, so the fast check exits early.
4. **Simple heuristic for search detection**: Check if the command starts with a search tool prefix. Don't try to parse bash pipeline semantics.

## Expected Impact

- **C7.1 pass rate**: Should return from 73.7% to >90% within 24h as the guard blocks all hallucinated-path bash commands
- **False positive rate**: Expected ~0% for normal operations; grep/sed/bun-e patterns are excluded
- **Performance**: Negligible — pure string matching, no IO, no async work

## Files Modified

- `src/lib/tools/path-hallucination-guard.ts` — Guard implementation (enhanced with sed + inline script exclusions)
- `src/lib/tools/path-hallucination-guard.test.ts` — 41 test cases (added 7 for sed/bun-e/node-e/python-c)
- `agents/shared/knowledge/experiments/EXP-132/results.md` — This file
