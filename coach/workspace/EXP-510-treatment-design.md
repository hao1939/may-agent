# EXP-510: Treatment Design — Structural Completion Injection

**Date**: 2026-05-14
**Author**: coach
**Status**: READY FOR DEPLOYMENT

## Injection Point

In `agents/shared/workflows/master-worker.ts`, after line 448 (after EXP-500 pre-read injection),
append a COMPLETION QUALITY block to `workerPrompt` for every worker dispatch.

## Proposed Code Change

```typescript
// EXP-510: Completion quality injection for worker sessions
workerPrompt += `\n\n---\nCOMPLETION REQUIREMENTS (structural — do not skip):\n1. Produce at least one file write/edit as deliverable evidence\n2. After completing work, read back modified files to verify correctness\n3. Call finish() with: status ('success'|'partial'|'failure'), summary (1-2 sentences of what you did), and deliverables (list of files modified)\n4. If task cannot be completed, finish(status:'blocked') with explanation\n\nDo NOT call finish({}) with empty input. Your finish() call IS your deliverable receipt.`;
ctx.log(`[work] EXP-510: Completion quality block injected`);
```

## Why This Should Work

1. **Baseline shows 0% structured finish** — agents call finish({}) universally. This may be because nothing tells them to use parameters.
2. **EXP-500 proved structural injection works** — same mechanism, same location in code.
3. **Low risk** — additive text only; doesn't constrain tool ordering (which EXP-495 proved fails).

## Why This Might Fail

1. finish() with empty `{}` may be an infrastructure bug (tool schema not exposing params to agent)
2. Agents may already be producing adequate work without verification step
3. Text might get lost in long prompts (attention dilution)

## Measurement Plan

- **Wait**: 30+ worker sessions post-deployment
- **Measure**: 
  - % sessions with ≥1 write/edit (target: ≥60%, baseline: 37%)
  - % sessions with structured finish (target: ≥50%, baseline: 0%)
  - % sessions with verify-after-write (target: ≥30%, baseline: ~0%)
- **Decision**: 
  - POSITIVE: ≥15pp improvement on primary metric (write rate)
  - NEGATIVE: <5pp improvement after 30 sessions

## Critical Investigation First

Before deploying, must verify: **Is finish({}) an infrastructure issue?**
- Check if finish tool schema exposes status/summary/deliverables params to agent
- If infra doesn't support structured finish, the 0% baseline is architectural, not behavioral
- In that case, focus treatment solely on write rate + verification

## Deployment Checklist

1. [ ] Verify finish() tool schema allows structured input
2. [ ] Add injection code after line 448 in master-worker.ts
3. [ ] Test with 1 manual dispatch to confirm injection appears in prompt
4. [ ] Deploy and log timestamp for measurement cutoff
