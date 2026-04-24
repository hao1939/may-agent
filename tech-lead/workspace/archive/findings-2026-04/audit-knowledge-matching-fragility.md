# Audit: Knowledge Matching Fragility — Lens D

**Date**: 2026-04-13  
**Scope**: `src/lib/knowledge-router.ts` + caller in `src/lib/manager.ts` (`buildSessionContext`, lines 658-667)  
**Index**: `agents/shared/knowledge/knowledge-index.json` (60 entries, 1088 lines)

---

## Failure Mode 1: Empty/Corrupt Knowledge Index

**Severity: LOW (silent degradation)**

**Code path**: `loadKnowledgeIndex()` (knowledge-router.ts:56-78)

When the index file doesn't exist (`!existsSync`), returns `[]` silently (line 66).  
When JSON is malformed (catch block, line 75), returns `[]` silently.  
When `parsed.entries` is undefined/null, the `??` fallback returns `[]` (line 72).

**What happens downstream**: `matchKnowledge()` receives empty array → early return `[]` (line 107) → `formatKnowledgeInjection()` returns `""` → `routeKnowledge()` returns `""` → `buildSessionContext` in manager.ts skips injection (line 665: `if (knowledgeBlock)`).

**Impact**: Knowledge routing silently stops working for ALL sessions. No error, no log, no metric. The system degrades invisibly. Given that H-043 claims this doubles effective learning rate, silent total failure is a meaningful risk.

**Evidence**:
- Line 75: bare `catch {}` swallows parse errors — no console.warn, no telemetry
- Line 66-67: missing file returns `[]` with no indication
- Process-level cache (`_cachedIndex`, line 49) means a corrupt read persists for the entire process lifetime — no retry on next call

**Additional concern**: The cache keys on `indexPath` string equality (line 62). If the file is deleted or replaced on disk after first load, the stale cached version persists. `clearKnowledgeIndexCache()` exists (line 82) but is only used in tests — never called in production code paths.

---

## Failure Mode 2: Substring Matching Returns False Positives

**Severity: MEDIUM (wrong knowledge injected)**

**Code path**: `matchKnowledge()` → keyword loop (knowledge-router.ts:110-115)

The matching uses `normalizedTask.includes(normalizedKw)` (line 112). This is **substring** matching, not word-boundary matching. Short keywords match inside unrelated words.

**Confirmed false positives** (11 keywords ≤3 chars across index):
| Entry | Keyword | False matches in typical task text |
|-------|---------|-----------------------------------|
| KE-020 | `"use"` | "beca**use**", "ref**use**", "**use**r", "ca**use**" |
| KE-054 | `"bug"` | "de**bug**", "ham**bug**er" (unlikely but shows pattern) |
| KE-054 | `"fix"` | "pre**fix**", "af**fix**" |
| KE-005 | `"QA"` | "s**qa**b" (rare, but principle holds) |
| KE-010/053/109 | `"gym"` | Less risky (uncommon substring) |

**Concrete scenario**: Any task containing common English words like "because", "user", or "refuse" will match KE-020 regardless of actual relevance. With 60 entries and only `maxResults=3` slots, a false positive displaces a genuinely relevant entry.

**Evidence**: Verified empirically — "Because we need better tests" matches keyword "use" via substring. "Build user authentication" also matches.

**Scoring amplification**: Score = count of matched keywords (line 117). An entry with many short/common keywords can accumulate a high score purely from false positives, outranking genuinely relevant entries.

---

## Failure Mode 3: Matched Entries Reference Deleted Files

**Severity: LOW (currently zero instances, but no guard)**

**Code path**: `formatKnowledgeInjection()` (knowledge-router.ts:158-168)

The output includes `(→ knowledge/${m.entry.file})` (line 166) but **never checks if the file exists on disk**. The `entry.file` field is trusted from the JSON index without validation.

**Current state**: All 60 entries reference files that exist (verified: 0 missing). But this is a manual invariant — nothing prevents:
1. Someone deleting a knowledge entry file without updating the index
2. Index referencing a renamed/moved file
3. Agent reading the injected pointer, trying to open the file, getting an error, wasting ops

**Impact**: When this breaks, agents see a knowledge pointer they can't follow. This is a paper-cut, not a crash — agents can't resolve the path and move on. But it wastes the knowledge routing opportunity for that entry.

---

## Failure Mode 4: Too Many Matches Overflow Context Budget

**Severity: LOW (bounded by design, but budget-unaware)**

**Code path**: `matchKnowledge()` → `.slice(0, maxResults)` (line 125), called with `maxResults=3` from manager.ts line 664.

The hard cap of 3 results means at most ~150 tokens of knowledge injection. This is well within typical context budgets.

**However**: The matching is completely budget-unaware:
- No check against remaining context window space
- No check against `memoryLimit` or any other budget parameter
- The `oneliner` field has no length constraint — a malformed entry with a 500-word "oneliner" would be injected verbatim
- `buildSessionContext` (manager.ts:564-680) concatenates knowledge block alongside history, checkpoint, context files, and context.md — total context size is never measured or capped

**Practical risk**: Low today because oneliners are short and max=3. But if `maxResults` is increased or oneliners grow, there's no safety valve. The context could silently exceed model limits, causing truncation of OTHER important context (like checkpoints or history).

---

## Summary Table

| # | Failure Mode | Severity | Silent? | Fix Complexity |
|---|---|---|---|---|
| 1 | Empty/corrupt index → zero matches, no signal | LOW | Yes | Trivial (add log/metric on empty load) |
| 2 | Substring matching → false positives from short keywords | MEDIUM | Yes | Moderate (word-boundary regex or minimum keyword length) |
| 3 | Deleted file references → broken pointers | LOW | Partially (agent sees error when reading) | Trivial (existsSync check in format step) |
| 4 | Context budget overflow | LOW | Yes | Moderate (measure total context, cap injection) |

## Recommended Actions (if prioritized)

1. **FM-2 (highest impact)**: Either enforce minimum keyword length ≥ 4 chars in the index schema, or switch from `includes()` to word-boundary matching (`new RegExp(\`\\b${escaped}\\b\`)`) at line 112. The 11 short keywords should be reviewed and either removed or expanded.
2. **FM-1**: Add a single `console.warn` in the catch block (line 75) and when file is missing (line 66). Optionally expose a metric for "knowledge entries loaded" so dashboards can detect silent failures.
3. **FM-3**: Add `existsSync` validation in `loadKnowledgeIndex` (drop entries with missing files) rather than at format time.
4. **FM-4**: No action needed at current scale. Revisit if entries grow beyond ~20 or maxResults increases.
