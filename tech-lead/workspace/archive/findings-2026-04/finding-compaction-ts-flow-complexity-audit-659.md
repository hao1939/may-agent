# Finding: compaction.ts Flow Complexity Audit

**File**: `src/lib/compaction.ts` (659 LOC)
**Lens**: B — Flow Complexity
**Date**: 2026-04-16

## Summary

compaction.ts is **well-structured and appropriately complex** for what it does. The flow is linear and deterministic (no LLM calls), with clear separation of concerns. No major refactoring needed.

## Flow Map

```
createCompactionTransform(model, opts)     ← factory, returns closure
  └→ returned async (messages) =>
       1. totalTokens(messages) < trigger?  → return early (no-op)
       2. Loop up to 3 passes:
          a. findSplitPoint(messages, keepTokens)
          b. extractOriginalTask() (first pass only, cached)
          c. summarizeMessages(oldMessages)        ← structural, not LLM
          d. extractKeyFacts(oldMessages)
          e. mergeKeyFacts(accumulated, new)
          f. trimAccumulatedSummary() if over budget
          g. Build synthetic UserMessage with compacted context
          h. result = [summaryMsg, ...recentMessages]
          i. Tighten keepTokens by 0.6× for next pass
       3. Return compacted messages
```

**Decision points**: 2 (trigger threshold check, safety ceiling multi-pass loop)
**Layers of indirection**: 1 (factory → closure). All helpers are direct calls, no callbacks or event chains.

## Findings

### 1. Clean architecture — Severity: None (positive finding)
- All helper functions (`extractKeyFacts`, `mergeKeyFacts`, `formatKeyFacts`, `summarizeMessages`, `findSplitPoint`, `trimAccumulatedSummary`) are pure functions with no side effects.
- State is captured in the closure (accumulatedSummary, accumulatedKeyFacts, cachedOriginalTask, compactionCount) — simple and correct.
- Constants are well-documented with rationale comments.

### 2. Token estimation is intentionally crude — Severity: Low
- `estimateTokens()` uses `Math.ceil(text.length / 3)` — a fixed ratio.
- The multi-pass safety loop (lines ~530-590) compensates for estimation drift, so this works in practice.
- Not worth replacing with a tokenizer unless real-world overflows are observed.

### 3. `findSplitPoint` boundary logic could be clearer — Severity: Low
- Lines ~310-335: The "walk forward to clean boundary" loop skips toolResult messages, which is correct but the intent could be a one-line comment.
- The `splitAt <= 1` guard at the end prevents compacting only the first message, which is the right call.

### 4. `summarizeMessages` preserves last reasoning block — Severity: Info
- This is a design choice worth noting: the last substantial assistant text (>100 chars) is preserved verbatim (up to 2000 chars) at the end of each compaction summary. This is the most important context for continuity.

### 5. No dead code detected — Severity: None
- All exports (`extractKeyFacts`, `mergeKeyFacts`, `formatKeyFacts`, `trimAccumulatedSummary`, `extractOriginalTask`, `createCompactionTransform`, `totalTokens`, `KeyFacts`, `CompactionInfo`, `CompactionOptions`) appear to be used or are part of the public API.

## Verdict

**No action needed.** This file is one of the cleaner modules in the codebase — well-documented constants, pure helper functions, linear flow, and bounded complexity (3-pass max). The ~660 LOC is justified by the thorough handling of edge cases (multi-round accumulation, summary budget trimming, original task preservation).
