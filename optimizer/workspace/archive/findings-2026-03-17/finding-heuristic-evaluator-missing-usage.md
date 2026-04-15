# Finding: Heuristic Evaluator Missing Usage Data

**Date:** 2026-03-17T19:55
**Severity:** HIGH — Makes cost analysis impossible for 99%+ of sessions
**Status:** Sent to tech-lead for implementation

## Problem

`writeHeuristicEvaluations()` in `src/lib/evaluator.ts` (line ~795) hardcodes all usage fields to 0:

```typescript
usage: {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
  cost: 0,
  turns: 0,
},
```

This means **every heuristic evaluation** (all root sessions = the vast majority) reports $0 cost and 0 turns.

## Impact

- Cost analysis from evaluation data is **blind** — we can't identify expensive sessions
- Turn counts are invisible — can't detect sessions using too many turns
- The `extractUsage()` function (line 68) exists and works but is never called by the heuristic path

## Root Cause

The heuristic evaluator reads the transcript as a raw string (`transcriptText`) for regex-based analysis. But `extractUsage()` requires parsed `AgentMessage[]` objects. Nobody connected the two.

## Fix

Parse the JSONL transcript into messages and call `extractUsage()`:

```typescript
// In writeHeuristicEvaluations(), after reading transcriptText (~line 767):
let messages: AgentMessage[] = [];
try {
  messages = transcriptText.trim().split('\n')
    .map(line => JSON.parse(line))
    .filter((m: any) => m.role === 'assistant');
} catch { /* partial parse OK — extractUsage handles empty arrays */ }

const usage = extractUsage(messages);
```

Then replace the hardcoded `usage: { ... }` block with `usage,`.

## Related

- Bug #2 (req:deab92c6): Error regex too broad — `Error:` matches evidence data
- Both bugs are in the same function area and can be fixed together
