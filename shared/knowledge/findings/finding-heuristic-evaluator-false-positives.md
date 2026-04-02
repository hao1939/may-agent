# Finding: Heuristic Evaluator Error Detection is Overly Broad

**Date:** 2026-03-17T19:36  
**Severity:** MEDIUM  
**Impact:** Inaccurate waste metrics, inflated `multiple_tool_errors` rate

## Problem

In `src/lib/evaluator.ts`, the `computeHeuristicScores()` function uses this regex to detect tool errors:

```typescript
const errorResults = (transcript.match(/P53 Violation|Error:|ENOENT|Cannot find/gi) || []).length;
```

This matches **any occurrence** of these strings anywhere in the transcript, including:
1. **Evidence data** — file contents agents are reading that contain "Error:" strings
2. **Code being reviewed** — `throw new Error(...)`, `TypeError:`, `SQLiteError:`
3. **Log analysis** — agents reading error logs (their job!) get penalized for the errors in those logs
4. **System Busy retries** — not agent errors at all

## Data

- **41 / 100** recent evaluations tagged `multiple_tool_errors` (41%)
- Example: Optimizer session with 44 productive calls and 8 "wasted" tagged as `multiple_tool_errors` — the "waste" was mostly `Error:` strings appearing in file contents being analyzed
- The `wastedCalls` metric is directly set to `min(errorResults, totalToolCalls)`, meaning content analysis sessions get wildly inflated waste numbers

## Proposed Fix

Replace the broad transcript-wide regex with a more targeted approach:

```typescript
// OLD (too broad — matches errors in evidence/data):
const errorResults = (transcript.match(/P53 Violation|Error:|ENOENT|Cannot find/gi) || []).length;

// NEW (only count actual tool failures):
// Count tool results that indicate the agent's tool call itself failed
const toolFailurePatterns = [
  /P53 Violation/g,              // Cross-edit guard violation (agent error)
  /Command exited with code [1-9]/g,  // Failed bash commands
  /ENOENT.*No such file/g,      // File not found (agent error)
  /⏳ System Busy/g,            // System contention (not agent error, but retry)
  /Validation failed for tool/g, // Wrong tool args (agent error)
];

let errorResults = 0;
for (const pattern of toolFailurePatterns) {
  errorResults += (transcript.match(pattern) || []).length;
}
// Exclude "System Busy" from waste count — it's not the agent's fault
const agentErrors = errorResults - (transcript.match(/⏳ System Busy/g) || []).length;
```

Key changes:
1. Remove `Error:` — too generic, matches everything
2. Remove `Cannot find` — too generic, matches legitimate search results  
3. Add `Command exited with code [1-9]` — actual bash failures
4. Add `Validation failed for tool` — wrong tool arguments
5. Separate "System Busy" (not agent's fault) from agent errors

## Who Should Fix This

Tech-lead — this is a code change to `src/lib/evaluator.ts` line ~870.

## Verification

After fix, re-run heuristic evaluations on recent sessions and verify:
- `multiple_tool_errors` rate drops from 41% to <15%
- `wastedCalls` numbers become more realistic
- Sessions doing legitimate error analysis don't get penalized
