# Audit: context-learn.ts Architecture Review

**Date**: 2026-04-13  
**File**: `src/lib/context-learn.ts` (589 lines)  
**Auditor**: Scout (Lens A)

---

## 1. Module Purpose

Extracts durable knowledge from session transcripts / arbitrary text and persists it to `agents/<name>/context.md` files. Offers two extraction modes (LLM-based, mechanical fallback) and two persistence strategies (patch via add/remove, full-merge via LLM).

## 2. Architecture

### Exports (10 functions, 6 types)

| Export | Layer | Type |
|--------|-------|------|
| `extractFacts()` | Extraction | async — LLM-based |
| `extractFactsMechanical()` | Extraction | sync — pattern-matching |
| `applyContextUpdates()` | Persistence | sync — add/remove patch |
| `readContext()` | Persistence | sync — read helper |
| `mergeContext()` | Persistence | async — LLM full-merge |
| `learnFromSessionLLM()` | Convenience | async — post-session w/ LLM |
| `learnFromSession()` | Convenience | sync — post-session mechanical |
| `learnFromText()` | Convenience | async — ad-hoc LLM merge |
| Types: `ContextUpdate`, `ContextUpdateResult`, `LLMCaller`, `TranscriptMessage`, `LearnFromSessionOptions`, `LearnFromSessionLLMOptions` | | |

### Entry Points

1. **Post-session hook** (`may.ts:566-615`): Listens for `context-learn` bus events. Calls `learnFromSessionLLM()` → falls back to `learnFromSession()`.
2. **finish() context_updates** (`session-subscribers.ts:22-55`): `createContextUpdater()` applies finish()'s `context_updates` directly to context.md — **does NOT use context-learn.ts at all**.
3. **Scripts**: `context-learn-backfill.sh` imports `learnFromSession` directly.
4. **Re-export**: `src/lib/index.ts` re-exports `learnFromSession`, `extractFactsMechanical`, `applyContextUpdates`, `readContext` + all types.

### Data Flow

```
Session ends
  → may.ts emits "context-learn" event on bus
  → subscriber in may.ts calls learnFromSessionLLM()
    → mergeContext() → LLM produces full context.md → writes file
    → [fallback] extractFactsMechanical() → applyContextUpdates() → patches file

finish() called with context_updates
  → session-subscribers.ts createContextUpdater()
  → reads/writes context.md directly (inline logic, no dedup)
```

## 3. Consumers

| Consumer | What it calls | Notes |
|----------|---------------|-------|
| `src/app/may.ts` | `learnFromSessionLLM`, `learnFromSession` | Post-session event handler |
| `src/lib/session-subscribers.ts` | **Nothing from context-learn.ts** | Reimplements add/remove inline |
| `src/lib/manager.ts` | None — reads context.md at session start | Consumer of the *output*, not the module |
| `scripts/context-learn-backfill.sh` | `learnFromSession` | One-off script |
| `src/lib/index.ts` | Re-exports 4 functions + 5 types | Public API surface |

## 4. Findings

### F-1: Duplicated context.md writer — MEDIUM

`session-subscribers.ts:createContextUpdater()` reimplements the same add/remove logic as `applyContextUpdates()` but without dedup (case-insensitive check) or size trimming. This means:
- finish() context_updates can add duplicates that the event-driven path would prevent
- finish() context_updates have no max-size enforcement (context.md grows unbounded)
- Two independent code paths write to the same file with slightly different semantics

**Fix**: `createContextUpdater()` should import and call `applyContextUpdates()`.

### F-2: `extractFacts()` is exported but has zero callers — LOW

The async LLM extraction function (Layer 1) is exported and documented for ad-hoc use, but nothing calls it. `learnFromSessionLLM()` calls `mergeContext()` directly, which has its own prompt. `extractFacts` uses a different prompt (EXTRACT_PROMPT — returns patches) while `mergeContext` uses MERGE_PROMPT (returns full file). The extract-then-apply path is dead in practice.

**Risk**: Low — it's a reasonable API for future use. But it means the module has two LLM prompts that overlap in purpose (extract patches vs. full merge), and only one is used.

### F-3: `learnFromText()` is a trivial wrapper — LOW

```ts
export async function learnFromText(...) {
  return mergeContext(...);
}
```

This is a 1-line passthrough to `mergeContext()`. It doesn't add behavior, error handling, or even different defaults. The docstring examples are its only value.

**Verdict**: Borderline. Earns its keep as a semantic entry point but adds no logic.

### F-4: Mechanical extractors are narrow and brittle — LOW

The three mechanical extractors (`extractCommandCorrections`, `extractRuntimeFacts`, `extractPathDiscoveries`) handle only a few specific patterns:
- npm→bun, node→bun/deno command corrections
- deno.json/bunfig.toml detection
- Failed-then-succeeded path corrections

These are hardcoded to specific tool names ("bash", "read") and runtime ecosystems. They're the fallback when LLM is unavailable, so narrowness is acceptable, but they'll silently miss most learnable facts.

**Not a bug** — by design as a safety net. But the gap between LLM extraction and mechanical extraction is enormous.

### F-5: No race protection on concurrent context.md writes — MEDIUM

Both the `context-learn` event handler (may.ts) and the `createContextUpdater` subscriber (session-subscribers.ts) can fire for the same session — one from the event bus, one from session_end. Both write to the same `agents/<name>/context.md` file. With `setTimeout(async () => {...}, 1000)` in may.ts, these can race.

**Impact**: Last-write-wins could drop updates. Unlikely in practice (context-learn only fires for CONTEXT_LEARN_AGENTS, and events are serialized per agent), but the architecture doesn't guarantee safety.

## 5. Overlap Analysis

### vs. knowledge-router.ts

**No functional overlap.** These are complementary systems:
- `context-learn.ts`: **Writes** to `context.md` (per-agent mutable knowledge)
- `knowledge-router.ts`: **Reads** from `knowledge-index.json` (shared immutable entries)

They meet at session start in `manager.ts` (lines 630-670), where both context.md and knowledge entries are injected into the prompt. But they don't share code or concepts.

### vs. research-db.ts

**No overlap.** `research-db.ts` syncs markdown research artifacts (knowledge entries, hypotheses, experiments) into SQLite for queryability. It deals with a completely different data domain (structured research metadata) and never touches context.md.

### vs. session-subscribers.ts createContextUpdater()

**Direct overlap** — see F-1. The subscriber reimplements context-learn's persistence logic without using it. This is the only real architectural smell.

## 6. Recommendations

1. **Merge the writers** (F-1, F-5): Make `createContextUpdater()` call `applyContextUpdates()` instead of reimplementing inline. This gives finish() the same dedup + size-trim behavior and eliminates the duplicate code path. ~10 lines changed.

2. **Consider deprecating `extractFacts()`** (F-2): If the extract-then-patch path is permanently superseded by mergeContext(), mark it `@deprecated` or remove it. If it's intentionally kept for future consumers, document that it's unused today.

3. **Leave the rest alone**: The 3-layer structure (extraction → persistence → convenience) is clean. The mechanical fallback is appropriately scoped. The module's 589 lines are justified by the two extraction modes + two persistence strategies + formatting helpers.

**Overall assessment**: Well-structured module with one real issue (F-1: duplicated writer) and one dead-code concern (F-2: unused extractFacts). No overlapping responsibilities with knowledge-router or research-db. The module does one thing — context learning — and the layered architecture makes it testable and reusable.
