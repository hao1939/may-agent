# Audit: Token Budget Management (compaction.ts + overflow.ts)

**Date:** 2026-04-12  
**Files:** `src/lib/compaction.ts` (659 lines), `src/lib/overflow.ts` (160 lines)  
**Related:** `src/lib/classify-error.ts` (67 lines), `src/lib/handoff.ts` (285 lines)

---

## 1. Architecture Map

### compaction.ts — Message Compaction / Summarization
**Purpose:** When a conversation approaches the context window limit, summarize older messages into a compact header so the agent can keep working without hitting overflow.

**Core flow:**
1. `createCompactionTransform(model, opts)` returns a closure that wraps the agent's `transformContext` hook
2. On each LLM call, the closure estimates total tokens (char/3 heuristic)
3. If tokens exceed threshold (default 70% of context window), splits messages into old + recent
4. Old messages → deterministic structural summary (not LLM-based)
5. Summary + recent messages sent to LLM; original messages preserved in JSONL
6. Multi-pass safety: if still >85% after compaction, re-compacts with tighter budget (up to 3 passes)

**Key data structures:**
- `KeyFacts` — files read/written/edited, exec commands, agent calls (survives trimming)
- Accumulated summary with section markers `--- (compacted) ---`
- Original task cached and preserved across rounds

**Consumers:**
- `manager.ts` → `createCompactionTransform()` (core integration)
- `handoff.ts` → `extractKeyFacts()` (reused for workflow step handoff)
- `overflow.ts` → `extractKeyFacts()` (reused for overflow recovery doc)

### overflow.ts — Overflow Error Detection + Recovery
**Purpose:** Two responsibilities:
1. **Detection:** `isOverflowError(error)` — regex-match error strings to identify context overflow
2. **Recovery:** `extractProgress(task, messages, error)` — extract a markdown document from a dead session's messages so a new session can continue

**Consumers:**
- `isOverflowError()`: manager.ts (3 call sites), manager-retry.ts (1 site), chat-session.ts (2 sites)
- `extractProgress()`: **DEAD CODE** — exported but never called in production. Only used in tests.

### classify-error.ts — Duplicate Overflow Detection
**Purpose:** General error classification (`infra | logic | abort | overflow`), used by the request tracking system.

**Overlap with overflow.ts:** Both detect "context overflow" from error strings, using different pattern sets:
- `overflow.ts`: 15 regex patterns (comprehensive, matches provider-specific messages)
- `classify-error.ts`: 4 substring checks (simpler, less coverage)

These are **independently maintained and can diverge silently**.

---

## 2. Dead Exports

| Export | File | Used externally? | Verdict |
|--------|------|-----------------|---------|
| `createCompactionTransform` | compaction.ts | ✅ manager.ts | Keep |
| `totalTokens` | compaction.ts | ❌ Only internal + tests | **Candidate for unexport** |
| `extractKeyFacts` | compaction.ts | ✅ handoff.ts, overflow.ts | Keep |
| `mergeKeyFacts` | compaction.ts | ❌ Only internal | **Candidate for unexport** |
| `formatKeyFacts` | compaction.ts | ❌ Only internal | **Candidate for unexport** |
| `extractOriginalTask` | compaction.ts | ❌ Only internal | **Candidate for unexport** |
| `trimAccumulatedSummary` | compaction.ts | ❌ Only tests | **Candidate for unexport** |
| `KeyFacts` (type) | compaction.ts | ✅ handoff.ts (transitively) | Keep |
| `CompactionOptions` (type) | compaction.ts | ✅ manager.ts, types.ts | Keep |
| `CompactionInfo` (type) | compaction.ts | ✅ index.ts re-export | Keep |
| `isOverflowError` | overflow.ts | ✅ manager.ts, manager-retry.ts, chat-session.ts | Keep |
| `extractProgress` | overflow.ts | ❌ **Never called in production** | **Dead code** |

**Finding: `extractProgress` is 65 lines of dead code.** It was likely intended for an overflow recovery feature that was never wired up. The system currently handles overflow by: (a) killing the session, (b) emitting a digest, (c) archiving chat sessions to prevent crash loops. None of these use `extractProgress`.

---

## 3. Overlap Analysis

### Overlap 1: Overflow detection in two places
- `overflow.ts::isOverflowError()` — 15 regex patterns, used for runtime decisions
- `classify-error.ts::classifyError()` — 4 substring checks, used for DB classification

**Risk:** An error string could match one detector but not the other. Example: `"prompt is too long"` matches `isOverflowError()` but NOT `classifyError()` (which checks for "context window", "max tokens", "context_length_exceeded", "too many tokens").

**Severity:** Medium. The two are used in different contexts (retry decisions vs DB tagging), so a mismatch means the DB might tag an overflow as "logic" while the retry system correctly identifies it as overflow. This creates confusing analytics but doesn't break runtime behavior.

**Recommendation:** `classifyError` should delegate to `isOverflowError()` for the overflow case instead of maintaining its own patterns.

### Overlap 2: Key facts extraction in compaction.ts vs handoff.ts
- `compaction.ts::extractKeyFacts()` extracts files read/written, exec commands, agent calls
- `handoff.ts::extractHandoff()` calls `extractKeyFacts()` and adds error extraction + write content previews

**Verdict:** This is **healthy reuse**, not duplication. handoff.ts correctly imports from compaction.ts.

### Overlap 3: extractProgress (overflow.ts) vs summarizeForHandoff (handoff.ts)
Both extract a structured summary from a message history:
- `extractProgress` → for overflow recovery (never used)
- `summarizeForHandoff` → for workflow step handoff (actively used)

They share ~50% structural similarity (tool call extraction, file tracking, last assistant text). If overflow recovery is ever needed, it should use `summarizeForHandoff` instead.

---

## 4. Complexity Assessment

### compaction.ts — Justified complexity ✅
The 659 lines handle a genuinely hard problem:
- Multi-round compaction with accumulated summaries
- Key fact extraction and merging across rounds
- Summary trimming to prevent "summary bloat"
- Original task preservation
- Split-point finding that respects message boundaries (tool call / result pairs)
- Multi-pass safety ceiling

Each piece earns its keep. The constants are well-documented. The algorithm is deterministic (no LLM calls during compaction), which is a good design choice — fast, predictable, debuggable.

**Minor concern:** The closure returned by `createCompactionTransform` captures 7 mutable variables (`compactionCount`, `accumulatedSummary`, `accumulatedKeyFacts`, `cachedOriginalTask`, `triggerTokens`, `keepTokens`, `summaryBudgetChars`). This is a lot of hidden state. If the closure were ever shared between sessions accidentally, the state would bleed. Currently safe because `buildTransformContext` creates a new closure per session.

### overflow.ts — Over-modularized for its content ⚠️
160 lines containing:
- 15 regex patterns (constant data)
- `isOverflowError()` — a 3-line function using those patterns
- `redactArgs()` — a utility function only used by `extractProgress`
- `extractProgress()` — 65 lines of dead code

If `extractProgress` were removed, this file would be 50 lines: the patterns array + a one-liner test function + a redactArgs helper that nobody needs.

---

## 5. Fragility Assessment

### Token estimation drift
The `estimateTokens` function uses chars/3 as a heuristic. The comment notes this was adjusted from chars/4 after causing overflow. The multi-pass safety ceiling (3 passes, 85% threshold) is the backstop.

**Risk:** If the heuristic drifts again (e.g., with a model that tokenizes differently), the safety ceiling handles it — but 3 passes of compaction is expensive. Each pass re-summarizes.

**Mitigation already present:** The onCompact callback logs token counts, so drift is observable.

### Missing error handling in summarizeMessages
`summarizeMessages` accesses `msg.content` properties without null checks in some paths. Example: the `toolResult` handler casts to `ToolResultMessage` and calls `.content.filter(...)` — if `content` is undefined, this throws.

**Severity:** Low — in practice, toolResult messages always have content, and this only affects the summary text (not the agent's operation).

### isOverflowError pattern maintenance
15 regexes maintained manually. When a new LLM provider returns a novel overflow message, it won't match. The system falls back to `classifyError()` for DB tagging, which also won't match, so it becomes "logic" error → no retry, no overflow handling.

**Mitigation:** The patterns are comprehensive for current providers. Adding patterns is a simple append. Not fragile in practice.

---

## 6. Simplification Recommendations

### P1: Remove dead `extractProgress` function
- **Files:** overflow.ts, index.ts
- **Impact:** Removes ~70 lines of dead code + `redactArgs` helper
- **Risk:** None — no production caller. Test file also removable.
- **Effort:** Trivial

### P2: Unify overflow detection
- **Files:** classify-error.ts, overflow.ts
- **Change:** Make `classifyError()` delegate to `isOverflowError()` for the overflow case
- **Impact:** Eliminates divergent pattern maintenance, ensures consistent classification
- **Risk:** Low — changes error classification for edge-case strings, but makes it more accurate
- **Effort:** Small

### P3: Reduce exported surface of compaction.ts
- **Change:** Mark `totalTokens`, `mergeKeyFacts`, `formatKeyFacts`, `extractOriginalTask`, `trimAccumulatedSummary` as non-exported (remove from public API)
- **Impact:** Cleaner module boundary; internal functions stay internal
- **Risk:** Would break tests that import these directly — may need to test via the public API instead
- **Effort:** Small, but test refactoring takes time

### P3: Consider inlining overflow.ts into classify-error.ts (after P1)
After removing `extractProgress`, overflow.ts is essentially just `isOverflowError()` + patterns. This could live in classify-error.ts alongside `classifyError()`, making the error classification a single module. But this is a taste choice, not a real problem.

---

## Summary

The token budget management subsystem is **well-architected for its problem domain**. compaction.ts handles a genuinely complex task with good design choices (deterministic, no LLM calls, multi-pass safety). The main issues are:

1. **Dead code:** `extractProgress` is never called — 70 lines to remove
2. **Divergent detectors:** `isOverflowError()` and `classifyError()` both detect overflow using different patterns that can disagree
3. **Over-export:** compaction.ts exports 5 internal functions that only it uses

None of these are urgent. The system works correctly. The recommendations are clean-up opportunities, not fixes for broken behavior.
