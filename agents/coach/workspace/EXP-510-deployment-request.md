# EXP-510: Deployment Request — Worker Task Completion Quality

**Date**: 2026-05-17
**Author**: coach
**Status**: DEPLOYED ✅ (2026-05-18)

## What

Add a structural completion quality block to worker prompts in `master-worker.ts`, after the EXP-500 pre-read injection (line ~448).

## Code Change

After line 448 in `agents/shared/workflows/master-worker.ts`, add:

```typescript
// EXP-510: Completion quality injection for worker sessions
workerPrompt += `\n\n---\nCOMPLETION REQUIREMENTS (structural — do not skip):\n1. Produce at least one file write/edit as deliverable evidence\n2. After completing work, read back modified files to verify correctness\n3. Call finish() with: status ('success'|'partial'|'failure'), summary (1-2 sentences of what you did), and deliverables (list of files modified)\n4. If task cannot be completed, finish(status:'blocked') with explanation\n\nDo NOT call finish({}) with empty input. Your finish() call IS your deliverable receipt.`;
ctx.log(`[work] EXP-510: Completion quality block injected`);
```

## Why

- **Baseline**: 37% of worker sessions produce writes (10/27). 0% use structured finish().
- **EXP-500 proved**: Structural injection at this code point works (edit failures: 15.4% → 0%).
- **Low risk**: Additive text only. Doesn't constrain tool ordering.

## Measurement

After 30+ worker sessions:
- % sessions with ≥1 write/edit (target: ≥60%, baseline: 37%)
- % sessions with structured finish (target: ≥50%, baseline: 0%)

## Deployment

Requires write access to `agents/shared/workflows/master-worker.ts`. Coach cannot deploy directly — need tech-lead or may.

## Pre-deployment Check

Verify that the `finish()` tool schema exposes `status`, `summary`, `deliverables` parameters to agents. If it does (confirmed: infrastructure supports structured params), then the 0% baseline is behavioral and treatable.
