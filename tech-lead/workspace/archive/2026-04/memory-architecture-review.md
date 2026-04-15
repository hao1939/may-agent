# Review: Tiered Memory Architecture Proposal

**Reviewer**: Tech-Lead  
**Date**: 2026-04-03  
**Proposal**: `agents/shared/projects/memory-architecture-tiered.md`

---

## Summary Assessment

The proposal correctly identifies that our memory is flat and unbounded. The three ideas are sound in theory, but the implementation costs are unevenly distributed. Idea 2 (consolidation) is the clear quick win. Idea 1 (three-tier) is architecturally expensive with unclear ROI given our current context.md sizes. Idea 3 (files-are-truth) is already our design philosophy — the gap is enforcement, not architecture.

---

## 1. Technical Feasibility

### Idea 1: Three-Tier Memory

**Current architecture** (what would need to change):

| Layer | Current | Proposed | Files Affected |
|-------|---------|----------|----------------|
| Working memory | Session messages in `session.jsonl` + rolling compaction (`session-compact.jsonl`) | Same (volatile per-session) | None — already works |
| Episodic memory | `memory/<name>.jsonl` (last N entries, configurable via `memoryLimit`) | Recent sessions with decay | `persistence.ts` (readMemoryEntries), `manager.ts` (buildSessionContext) |
| Semantic memory | `agents/<name>/context.md` (flat, 1-2KB) + `knowledge/` dirs | Consolidated, permanent | `context-learn.ts`, `manager.ts` |

**What actually needs building**: The proposal says "requires architectural changes to how agents load context" — but the architecture is already tiered. The loading happens in `manager.ts:buildSessionContext()` (lines 490-570):

1. **Working memory** — handled by pi-agent-core's message history + our rolling compaction (`compaction.ts`). Already volatile.
2. **Episodic memory** — `readMemoryEntries(persistDir, name, memoryLimit)` loads the last N session summaries (default 20). Already exists with a configurable window.
3. **Semantic memory** — `context.md` is loaded at session start. Already persistent.

**The real gap isn't tier structure — it's tier quality:**
- Episodic memory has no decay weighting (entry #1 and entry #20 look identical)
- Semantic memory has no consolidation (duplicates accumulate)
- No mechanism promotes episodic patterns to semantic memory

**Breaking risk**: Moderate. Changing how `buildSessionContext()` assembles the prompt affects every agent. The context block is prepended to the first user message (not system prompt) for KV-cache stability (P147). Any structural change here invalidates all prompt caches and can shift agent behavior unpredictably.

### Idea 2: Memory Consolidation

**Feasible today.** `context-learn.ts` already has two paths:
- `applyContextUpdates()` — mechanical add/remove (used by `finish(context_updates)`)
- `mergeContext()` — LLM-based full rewrite (used by `learnFromSessionLLM`)

A consolidation pass would be a new function in `context-learn.ts` that:
1. Reads `context.md` (currently 1-2KB per agent, 15KB total across 10 agents)
2. Calls evaluator to merge/deduplicate
3. Writes back

**Implementation**: ~50 lines. Add `consolidateContext(contextPath, manager)` to `context-learn.ts`. Hook it into the existing cron system (e.g., run weekly per agent). No changes to `persistence.ts` or `manager.ts`.

**Breaking risk**: Low. Only modifies `context.md` content, not how it's loaded. Worst case: LLM removes a useful fact (mitigated by git history in agents/ repo).

### Idea 3: Files Are Truth

**Already implemented in code.** Every session starts fresh — `buildSessionContext()` reads from disk, not from any in-memory cache. The compaction snapshot (`session-compact.jsonl`) is a disk file read on session resume, not memory.

**The gap is behavioral**: agents sometimes reference things from their compacted context as if they "remember" them, when the compacted context is an LLM summary that may have hallucinated details. This is a prompt/instruction issue, not an architecture issue.

**Breaking risk**: Zero for code. Prompt-level fix only.

---

## 2. Implementation Complexity

| Idea | Effort | Value | Recommendation |
|------|--------|-------|----------------|
| Three-Tier | High (2-3 sessions) | Low — we already have tiers | **Defer** — name what we have, don't rebuild |
| Consolidation | Low (1 session) | Medium — removes cruft, prevents context.md bloat | **Build** — quick win, as proposed |
| Files Are Truth | Trivial | Low — already true | **Document** — add to agent onboarding, not code |

### Detailed complexity for Consolidation (Idea 2):

```
1. New function: consolidateContext(contextPath, manager) in context-learn.ts
2. Prompt: "Merge duplicate facts, remove stale entries, keep under 25 lines"
3. Cron hook: add to May's cron with weekly cadence per agent
4. Safety: git diff before/after, log what changed
```

Estimated: 50 lines new code + 10 lines cron config.

---

## 3. What Would Break

### If we implement Three-Tier naively:
- **Prompt cache invalidation** — changing the context block structure in `buildSessionContext()` invalidates Anthropic's KV cache for every agent. Cost impact: ~$2-5/day during transition.
- **Agent behavior shifts** — agents have calibrated their behavior to the current context format. Changing what they see at session start changes how they behave. This is hard to test and hard to roll back.
- **Memory JSONL growth** — our memory files are already 0.6-2MB each (2154 total entries). Adding more structure (decay weights, tier metadata) to each entry increases size. Current `readLastNJsonlLines` is optimized for tail reads; adding per-entry metadata queries would need indexing (probably SQLite, which we already have for sessions).

### If we implement Consolidation:
- **Fact loss** — LLM might remove a fact that seems redundant but isn't. Mitigated by: (a) context.md is in agents/ git repo, (b) dry-run mode that logs proposed changes without applying.
- **Nothing else** — this doesn't touch session loading, memory format, or prompt structure.

### If we implement Files Are Truth:
- **Nothing breaks** — it's a documentation/prompt change.

---

## 4. Counter-Proposal: Name the Tiers We Already Have

Instead of building new architecture, I suggest we:

1. **Document the existing three tiers** in a design doc:
   - Working: session messages + compaction (`compaction.ts`)
   - Episodic: memory JSONL with configurable window (`persistence.ts:readMemoryEntries`)
   - Semantic: context.md with LLM merge (`context-learn.ts:mergeContext`)

2. **Build the consolidation pass** (Idea 2) — this is the actual gap.

3. **Add episodic decay** as a small enhancement to `readMemoryEntries`: weight recent entries more heavily in the prompt (e.g., last 5 get full detail, next 15 get one-line summaries). This is ~20 lines in `manager.ts:buildSessionContext()`.

4. **Measure first**: Before building more, instrument what agents actually use from their context. Add a simple "context hit rate" metric — when an agent references a fact from context.md in its session, log it. This tells us whether consolidation actually helps or if agents ignore most of context.md anyway.

---

## Verdict

**Build Idea 2 (consolidation). Defer Idea 1 (three-tier architecture) — we already have the tiers, we just haven't named them. Skip Idea 3 (files-are-truth) — already true in code, just needs a doc line.**

The proposal's framing of "no differentiation between working memory, short-term memory, and long-term knowledge" is incorrect — we have all three (`session.jsonl` / `memory/*.jsonl` / `context.md`). The real problem is that the episodic-to-semantic promotion is manual (agents write `context_updates` in `finish()`) and the semantic tier never consolidates. Fix those two things and we get 80% of the value at 20% of the cost.
