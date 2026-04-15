# Architecture Review: compaction.ts (659 LOC)

**Date:** 2026-04-15  
**File:** `src/lib/compaction.ts`  
**Prior audit:** `agents/tech-lead/workspace/archive/2026-04/audit-token-budget-management.md` (2026-04-12)

## Summary

compaction.ts is a **well-isolated, zero-internal-dependency module** that handles context window management through deterministic message summarization. It contains 7 distinct subsystems in a single file, exports 8 symbols (5 over-exported), and its only consumers are manager.ts, handoff.ts, and index.ts. Architecture is sound — the main concern is over-exported surface area, not structural problems.

## 1. Subsystem Inventory (7 responsibilities)

| # | Subsystem | Lines | Functions | Notes |
|---|-----------|-------|-----------|-------|
| 1 | Token estimation | L11-L44 | `estimateTokens()`, `messageTokens()`, `totalTokens()` | 1 token ≈ 3 chars heuristic |
| 2 | Key facts extraction | L107-L157 | `extractKeyFacts()` | Walks messages, extracts files read/written/edited, exec commands, agent calls |
| 3 | Key facts merging | L163-L199 | `mergeKeyFacts()` | Union-merges file sets, dedupes exec commands, caps at MAX_EXEC_COMMANDS_IN_FACTS=15 |
| 4 | Key facts formatting | L204-L237 | `formatKeyFacts()` | Renders facts into display lines for compacted header |
| 5 | Message summarization | L258-L333 | `summarizeMessages()` (private) | Structural extraction — NOT LLM-based. Preserves last substantial reasoning block |
| 6 | Split-point calculation | L341-L371 | `findSplitPoint()` (private) | Walks backward counting tokens, adjusts to clean message boundary |
| 7 | Summary trimming | L384-L417 | `trimAccumulatedSummary()` | Drops oldest compaction sections when summary exceeds budget |
| 8 | Original task extraction | L246-L262 | `extractOriginalTask()` | Finds first user message text |
| 9 | Compaction transform factory | L455-L649 | `createCompactionTransform()` | Closure-based — returns async transform, captures 7 mutable state vars |

**Constants**: 10 well-documented constants (L47-L96) controlling thresholds, preview lengths, budgets.
**Types**: `KeyFacts` interface (L101-L110), `CompactionOptions` interface (L420-L435), `CompactionInfo` interface (L437-L449).

## 2. Interface Cohesion

### Exported symbols (8 total)
| Symbol | Used externally? | Where? |
|--------|-----------------|--------|
| `totalTokens()` | ❌ Only tests | Over-exported |
| `extractKeyFacts()` | ✅ `handoff.ts:4` | Healthy reuse |
| `mergeKeyFacts()` | ❌ Only internal | Over-exported |
| `formatKeyFacts()` | ❌ Only internal | Over-exported |
| `extractOriginalTask()` | ❌ Only internal + tests | Over-exported |
| `trimAccumulatedSummary()` | ❌ Only tests | Over-exported |
| `createCompactionTransform()` | ✅ `manager.ts:56`, `index.ts:69` | Core API |
| `KeyFacts` (type) | ✅ `handoff.ts` transitively | Keep |
| `CompactionOptions` (type) | ✅ `manager.ts:57`, `manager-utils.ts` | Keep |
| `CompactionInfo` (type) | ✅ `index.ts:70` | Keep |

**5 of 8 function exports are internal-only** — they're exported solely for test access. This inflates the public API surface.

## 3. External Dependencies

**Minimal and clean:**
- `@mariozechner/pi-agent-core` → `AgentMessage` (type only)
- `@mariozechner/pi-ai` → `UserMessage`, `ToolResultMessage`, `Model` (types + Model for contextWindow)

**Zero internal lib/ imports.** This is excellent — compaction.ts is a leaf module with no coupling to persistence, manager, or any other lib/ file.

## 4. Consumers (coupling analysis)

| Consumer | What it uses | Coupling level |
|----------|-------------|----------------|
| `manager.ts:56,292-354` | `createCompactionTransform`, `CompactionOptions` | Moderate — manager wraps the transform with persistence side-effects (L328-339) |
| `manager.ts:945-966,1344-1400` | Same via `buildTransformContext()` | Used in `callAgent()` and `resumeSession()` |
| `handoff.ts:4,88-89` | `extractKeyFacts()` | Light — borrows the fact extractor for workflow handoffs |
| `index.ts:69-70` | Re-exports `createCompactionTransform`, types | Barrel file |
| `manager-utils.ts` | `CompactionOptions` type only | Type-only import |

## 5. Overlap with overflow.ts

`overflow.ts` (28 lines) does error **detection** — regex-matching API error strings to identify context overflow errors. `compaction.ts` does overflow **prevention** — summarizing messages before they hit the limit.

**No functional overlap.** They're complementary:
- compaction.ts → preventive (runs before LLM call)
- overflow.ts → reactive (detects after LLM call fails)

## 6. Architectural Concerns

### Severity: LOW — Closure state bloat
The closure returned by `createCompactionTransform()` (L455-L649) captures **7 mutable variables**: `compactionCount`, `accumulatedSummary`, `accumulatedKeyFacts`, `cachedOriginalTask`, `triggerTokens`, `keepTokens`, `summaryBudgetChars`. Currently safe because `buildTransformContext()` creates a fresh closure per session, but this pattern makes accidental state sharing between sessions a latent risk.

### Severity: LOW — Over-exported API
5 functions exported only for test visibility. This is a common pattern but inflates the module's apparent API surface. Could use `@internal` JSDoc annotations or a test-only export path.

### Severity: INFO — Single-file cohesion
659 lines in one file is reasonable for this problem. The 7 subsystems are tightly coupled (they share types and constants), so splitting into multiple files would create coupling without reducing complexity. **No split recommended.**

### Severity: INFO — No LLM calls
The summarization is purely structural (deterministic, no LLM). This is a deliberate and good design choice — fast, predictable, debuggable. The tradeoff is lower summary quality vs. LLM-based compaction, but the reliability benefit outweighs it.

## 7. Non-Findings

- **No dead code detected.** All private functions are called. All constants are referenced.
- **No god-object pattern.** The file is a collection of pure functions + one factory function, not a class with accumulated state.
- **No circular dependencies.** Zero internal imports = impossible to create cycles.
- **Test coverage is excellent.** `test/compaction.test.ts` has ~50 tests (per prior audit at `agents/tech-lead/workspace/archive/2026-03/test-infrastructure-review.md:59`).

## Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P3 | Reduce exported surface — mark `totalTokens`, `mergeKeyFacts`, `formatKeyFacts`, `extractOriginalTask`, `trimAccumulatedSummary` with `@internal` JSDoc or move to a `compaction.internal.ts` re-exported only in tests | Small |
| None | No structural changes, no splits, no refactors needed | — |

## Prior Audit Delta

The 2026-04-12 audit (`audit-token-budget-management.md`) covered this file + overflow.ts together. Its findings align with this review. The P3 over-export finding was already identified there. No new architectural concerns discovered in this pass.
