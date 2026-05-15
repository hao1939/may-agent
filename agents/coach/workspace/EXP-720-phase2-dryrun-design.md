# EXP-720 Phase 2: Dry-Run Logging Design

**Date**: 2029-09-03
**Status**: DESIGNED — ready for implementation
**Depends on**: Phase 1 coverage audit (H1 PARTIALLY SUPPORTED, 25-35% est.)

## Objective

Add non-injecting logging to master-worker.ts that records which worker tasks WOULD receive few-shot injection, without actually injecting. This validates match rate and false positive rate before committing to full integration.

## Proposed Code Change

Insert after EXP-565 block (~line 456) and before `worker.prompt()` (~line 458):

```typescript
// EXP-720: Few-shot dry-run logging (measure match rate before injection)
try {
  const { selectExamples } = await import("./fewshot-inject-helpers.js");
  const matches = selectExamples(guidance);
  if (matches.length > 0) {
    const logLine = JSON.stringify({
      ts: new Date().toISOString(),
      iteration,
      matchedFiles: matches.map((m: any) => m.file || m),
      guidancePreview: guidance.slice(0, 200),
    });
    appendFileSync("agents/shared/exp720-fewshot-dryrun.log", logLine + "\n");
    ctx.log(`[work] EXP-720 dry-run: ${matches.length} few-shot match(es) — NOT injected yet`);
  }
} catch { /* non-critical — don't break worker flow */ }
```

## Tightened Patterns (Recommendation)

Phase 1 identified high false positive risk on Pattern #2. Before enabling actual injection, tighten:

| # | Current Pattern | Proposed Tighter Pattern | Rationale |
|---|----------------|-------------------------|-----------|
| 2 | `/bug\|error\|failing\|test.*fail\|crash\|500\|exception/i` | `/debug\|test.*fail\|crash\|exception\|error.*fix\|fix.*error/i` | Remove bare `error` and `failing` — too broad |
| 5 | `/fix.*bug\|broken\|failing\|doesn't.*work\|incorrect.*output/i` | `/fix.*bug\|broken.*(?:test\|build\|output)\|incorrect.*output\|wrong.*result/i` | Require context after `broken` |

Leave patterns 1, 3, 4 as-is (already specific enough).

## Measurement Plan

After 50+ worker iterations with dry-run logging:
1. Parse `exp720-fewshot-dryrun.log`
2. Calculate: match rate, which patterns fire most, false positive rate (manual review of guidancePreview)
3. If match rate ≥15% with <30% false positive → proceed to Phase 3 (actual injection)
4. If false positive >50% → tighten patterns and re-measure

## Phase 3 Preview (post dry-run)

Replace dry-run logging with actual injection:
```typescript
// EXP-720: Few-shot injection for worker tasks
const enrichedPrompt = injectFewShot(workerPrompt);
```

This requires binary rebuild. Escalate to tech-lead when Phase 2 data supports proceeding.

## Risk

- Dry-run import of `fewshot-inject-helpers.js` may fail if module path differs at runtime
- `appendFileSync` may fail on first call if directory doesn't exist (mitigated: `agents/shared/` exists)
- Zero risk to worker functionality — entire block is try/catch with no-op fallback

## Blocker

Same as Phase 1 note: TS changes require binary rebuild. The dry-run code change is small and low-risk but still needs rebuild to take effect.

## Decision

**RECOMMENDATION**: Since binary rebuild is a known blocker for ALL TS changes, and we cannot get dry-run data without it, propose a **bundled rebuild** that includes:
1. EXP-720 dry-run logging (this)
2. EXP-630 duration gate activation (long-standing blocker)
3. Any other pending TS fixes

This amortizes the rebuild cost across multiple experiments.
