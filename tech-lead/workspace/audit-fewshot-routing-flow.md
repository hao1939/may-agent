# Audit: fewshot-router.ts Routing Flow Complexity

**Lens**: B — routing flow complexity  
**Date**: 2026-04-13  
**Files**: `src/lib/fewshot-router.ts` (217 lines), `src/lib/manager.ts` (integration at L1078-1088)

## 1. End-to-End Flow Trace

The routing flow from task arrival to injection is **4 hops**, all within a single file + one callsite:

```
manager.ts:startSession()
  └─ routeFewShotExamples(task, agentName, projectRoot)     [fewshot-router.ts:189]
       ├─ Agent eligibility check (TARGET_AGENTS set)        [L200]
       ├─ loadFewShotExamples(projectRoot)                   [L205] — cached after first call
       │    └─ readdirSync + readFileSync per .md file
       │         ├─ parseTriggerPattern() — regex from fenced code block
       │         ├─ extractWorkedExample() — "## Worked Example" section
       │         └─ parseTokenEstimate() — from frontmatter
       ├─ matchFewShotExamples(task, examples)               [L206]
       │    └─ filter by regex .test(), sort by token size, cap at MAX_EXAMPLES/MAX_TOKEN_BUDGET
       └─ formatFewShotInjection(matched)                    [L212]
            └─ Wrap in "## Reference: How a similar task was handled" header

manager.ts then concatenates: sessionContext + fewShotBlock + task → promptText
```

## 2. Architecture Assessment

**Verdict: CLEAN — low complexity, appropriate abstraction level.**

### What's right
- **Single entry point**: `routeFewShotExamples()` is the only public API consumed by manager.ts. No unnecessary service classes, no builder pattern, no middleware chain.
- **Flat call graph**: 4 internal functions, no nesting beyond 2 levels, no callbacks or async complexity.
- **Caching done right**: `loadFewShotExamples()` caches after first load, keyed by directory path. Simple and effective.
- **Early returns**: Heartbeat filter, agent eligibility, and empty-match all bail early with zero-cost result objects.
- **No channel abstraction**: Despite KE-129's "channel" terminology, the router correctly avoids introducing a channel classification layer. It's regex match → select → format. The simplicity is a feature.

### Findings

| # | Severity | Finding | Detail |
|---|----------|---------|--------|
| 1 | LOW | Synchronous filesystem reads on hot path | `loadFewShotExamples()` uses `readFileSync` for 6 example files. Cached after first call so only cold-start matters. With 6 small .md files this is ~1ms. Not worth async conversion. |
| 2 | LOW | Cache invalidation is manual-only | `clearFewShotCache()` exists for tests but there's no mechanism to reload if example files change at runtime. Acceptable for Phase 1 — examples change rarely (deploy-time only). |
| 3 | LOW | `MAX_TOKEN_BUDGET` skips rather than truncates | In `matchFewShotExamples()`, if an example exceeds remaining budget it's `continue`d (skipped), not truncated. This means a 2500-token example after a 1000-token one gets skipped even though it might be the more relevant match. Current token estimates are all ~500-800 so this doesn't bite yet. |
| 4 | INFO | Regex triggers are per-file, not centralized | Each .md example file contains its own trigger regex in a fenced code block. This is actually good (colocation), but means discovering "what triggers what" requires reading each file. The INDEX.md could list patterns for quick reference. |

## 3. Complexity Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total lines | 217 | Well within budget |
| Public exports | 5 (routeFewShotExamples, loadFewShotExamples, matchFewShotExamples, formatFewShotInjection, clearFewShotCache) | Slightly generous — matchFewShotExamples and formatFewShotInjection could be internal. But testability benefits outweigh. |
| Integration points | 1 (manager.ts L1078-1088) | Minimal coupling |
| Hops from task string to injected content | 4 function calls | No unnecessary indirection |
| Abstraction layers | 1 (the router itself) | No factory/strategy/middleware pattern overhead |

## 4. Comparison with knowledge-router.ts Pattern

The file header says it "follows the routeKnowledge() pattern." This is accurate:
- Both do: load from disk → regex match → format → return content string
- Both cache after first load
- Both are consumed by a single callsite in manager.ts

The fewshot-router is actually *simpler* than knowledge-router because it doesn't need category-based weighting or agent-specific knowledge sets.

## 5. Recommendations

**No refactoring needed.** This is one of the cleaner modules in the codebase. The only action items are minor:

1. **Consider making `matchFewShotExamples` and `formatFewShotInjection` non-exported** if no external tests depend on them directly. Reduces public surface area.
2. **Add trigger pattern summary to INDEX.md** so operators can quickly see what matches without reading each file.
3. **When Phase 2 expands TARGET_AGENTS**: ensure the agent check remains a simple Set lookup, don't introduce a config system.

## 6. Risk Assessment

- **Complexity risk**: NONE — this module is unlikely to accumulate complexity debt
- **Performance risk**: NONE — cached reads, simple regex matching, bounded output
- **Correctness risk**: LOW — the `continue` vs `break` in token budget enforcement could surprise if example sizes grow significantly, but current data doesn't trigger it
