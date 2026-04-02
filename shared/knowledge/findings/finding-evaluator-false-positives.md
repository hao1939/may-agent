# Finding: Heuristic Evaluator Inflates Waste Due to Content-in-Transcript

**Date**: 2026-03-18T05:13
**Severity**: Medium — causes incorrect efficiency scores, misleads optimization decisions

## Problem

The heuristic evaluator in `src/lib/evaluator.ts:computeHeuristicScores()` counts "hard errors" by running a regex against the **full transcript string**:

```typescript
const hardErrors = (transcript.match(
  /P53 Violation|ENOENT: no such file|Error: ENOENT|Cannot find module|Validation failed for tool/gi
) || []).length;
```

This regex matches error strings that appear **anywhere** in the transcript — including:
- File contents read by the agent (e.g., ERROR_LOG.jsonl being analyzed)
- Tool output showing log data
- Assistant text discussing errors found in other sessions

## Evidence

### Session s_1773809201092_471 (Coach)
- Evaluator scored: **0 productive, 22 wasted** (100% waste)
- Actual receipts: 20 tool calls (7 reads, 7 bash, 4 edits, 1 finish) → agent did real work
- Regex matched 8 error strings (1 P53, 2 Cannot find module, 5 Validation failed)
- Many were in content being *analyzed*, not actual session errors

### Session s_1773804009695_410 (Coach heartbeat)
- Evaluator scored: **12 productive, 38 wasted** (76% waste)  
- Actual receipts: 47 tool calls (29 bash, 9 read, 4 edit, 4 agents, 1 finish)
- Agent was doing error-driven growth — reading and analyzing error data
- Error strings in the read content inflate the hardErrors count

### Aggregate Impact (last 2h)
- Coach: 110 total "wasted" calls across 11 sessions — likely 50%+ are false positives
- Every agent session shows `multiple_tool_errors` issue — 100% of non-idle sessions have this flag

## Root Cause

The regex doesn't distinguish between:
1. **Actual tool errors**: Error strings in `toolResult` messages with `isError: true`
2. **Content containing error strings**: Error strings in read file contents, bash output, or assistant analysis

## Proposed Fix

Parse the transcript as structured JSON instead of raw string matching. Count only errors where:
```typescript
// Only count tool results that are actual errors
const messages = JSON.parse('[' + transcript + ']'); // or proper parsing
const hardErrors = messages.filter(m => 
  m.type === 'toolResult' && m.isError === true
).length;
```

Alternatively, for the simpler approach: only match error patterns in lines that also contain `"isError":true` or `"status":"error"`.

## Impact of Fix

- **Accuracy**: Efficiency scores would reflect actual session quality, not content contamination
- **Downstream**: Cost outlier scans and agent evaluations would be more reliable
- **Coach**: Would stop being penalized for doing its job (analyzing errors)
