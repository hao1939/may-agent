# Implementation Plan: Tool Pivot Heuristic

**Source**: `agents/bob/workspace/brief-tool-pivot-logic.md`
**Target**: `src/lib/manager.ts`

## Changes

### 1. Add `toolErrorHistory` to `ActiveSession`

Add a `Map<string, number>` to track recent tool error counts, keyed by `tool:argsHash`.

```typescript
/** Tracks identical failed tool calls for pivot heuristic (P-PIVOT). Key: "toolName:argsHash", Value: consecutive error count. */
toolErrorHistory: Map<string, number>;
```

### 2. Add helper to compute args fingerprint

Simple JSON.stringify + hash to fingerprint tool args.

### 3. Add pivot check in `wrapToolsWithReceipts`

**Before** executing the tool:
- Compute fingerprint = `${tool.name}:${hash(JSON.stringify(params))}`
- Look up count in session's `toolErrorHistory`
- If count >= 3: **deny** the call with `E_RETRY_LIMIT` error, log event
- (No pre-call critique injection — critique comes after error)

**After** the tool returns:
- If tool result contains `isError: true` or exit code != 0:
  - Increment count in `toolErrorHistory`
  - If count == 1 or 2: append critique text to the result
  - If count == 3: the next identical call will be denied
- If tool succeeds: **clear** that fingerprint from the map (reset on success)

### 4. Log E_RETRY_LIMIT to session-metrics.jsonl

Append `{ type: "pivot_limit", sessionId, agent, tool, fingerprint, timestamp }` to `.state/session-metrics.jsonl`.

### 5. Initialize in session creation

Set `toolErrorHistory: new Map()` in both `run()` and `resume()` session creation blocks.

## Test Plan

Create `test/tool-pivot.test.ts`:
- Test 1: First error — no critique (just normal error)
- Test 2: Second identical error — critique injected
- Test 3: Third identical error attempt — denied with E_RETRY_LIMIT
- Test 4: Different args resets counter
- Test 5: Successful call resets counter
- Test 6: E_RETRY_LIMIT logged to metrics file
