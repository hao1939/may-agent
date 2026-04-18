# Fragility Audit: context-learn.ts (589 LOC)

**Date**: 2026-04-16  
**Lens**: D (Fragility)  
**File**: `src/lib/context-learn.ts`

## Summary

The knowledge extraction/persistence pipeline is **moderately fragile**. LLM failure paths are well-handled (silent catch → empty results), but the context file mutation layer has several single-bug cascade risks around data loss and silent corruption.

## Findings

### F1: Size-trimming loop deletes from the WRONG END (Severity: HIGH)

**Location**: `applyContextUpdates()`, lines ~143-148

```ts
while (content.length > maxSize) {
  const idx = content.indexOf("\n", 1);
  if (idx === -1) break;
  content = content.slice(idx + 1);
}
```

This trims from the **top** of the file. Since new facts are appended at the bottom, old facts are silently dropped. But if the file has a header (e.g., `# Context for agent-name`), **the header is the first thing deleted**, corrupting the file structure. The `mergeContext()` function has the same pattern (lines ~205-208: `lines.shift()`).

**Blast radius**: Every agent's context.md that hits the 2048-byte limit loses its header and oldest facts with no warning or log.

### F2: Case-insensitive dedup/remove is overly aggressive (Severity: MEDIUM)

**Location**: `applyContextUpdates()`, lines ~130-139

```ts
// Add dedup
lines.some(line => line.toLowerCase().includes(trimmed.toLowerCase()))
// Remove
lines.filter(l => !l.toLowerCase().includes(trimmed.toLowerCase()))
```

Both use `includes()` not equality. A remove for `"bun"` would delete every line containing "bun" (e.g., "bunfig.toml is at root", "Use bun test not npm test"). An add of `"test"` would be considered a duplicate if ANY line contains "test".

**Blast radius**: Short/common words in remove operations can wipe unrelated facts. Dedup prevents legitimate facts from being added.

### F3: No file-write atomicity — partial writes corrupt context (Severity: MEDIUM)

**Location**: `applyContextUpdates()` line ~155, `mergeContext()` line ~213

Both use bare `writeFileSync(contextPath, content)`. If the process is killed mid-write (OOM, timeout, signal), the file is truncated/empty. No temp-file-then-rename pattern.

**Blast radius**: Agent loses its entire learned context. Since there's no backup or journaling, recovery requires manual reconstruction.

### F4: `mergeContext()` trusts LLM output as complete file replacement (Severity: MEDIUM)

**Location**: `mergeContext()`, lines ~195-215

The LLM produces the COMPLETE new context.md. If the LLM hallucinates, forgets facts, or returns a near-empty response, the entire existing context is **overwritten** with the degraded version. The only guard is `if (added.length === 0 && removed.length === 0 && merged === existing)` — but a hallucinated rewrite that changes wording of all facts would pass this check and proceed.

**Blast radius**: Single bad LLM call can erase an agent's accumulated knowledge.

### F5: `parseContextUpdates()` silently swallows malformed JSON (Severity: LOW)

**Location**: lines ~320-340

If LLM returns malformed JSON, the catch returns `[]`. This is intentionally defensive, but means extraction silently produces zero results with no logging. Combined with `extractFacts()` also catching and returning `[]` (line ~97), there are TWO silent catch layers — if the LLM consistently fails, no one would know.

**Blast radius**: Low — mechanical fallback exists. But debugging "why isn't agent X learning?" would be hard.

### F6: Mechanical extractors have O(n²) nested loops (Severity: LOW)

**Location**: `extractCommandCorrections()` lines ~360-430, `extractPathDiscoveries()` lines ~460-490

Both iterate bash calls × bash calls (or read calls × read calls). For sessions with many tool calls (100+), this could be slow. Not a correctness issue but a latency fragility.

## Recommended Actions

1. **F1**: Change trimming to remove from the bottom (newest) or add a protected-header check. Or better: trim from the middle, keeping newest and oldest.
2. **F2**: Use exact line matching for dedup/remove instead of substring `includes()`.
3. **F4**: Add a safety check: if merged content is <50% the size of existing content, reject the merge and keep existing.
4. **F3**: Use write-to-temp-then-rename pattern for atomicity.
5. **F5**: Add a debug log when JSON parsing fails (even if result is still `[]`).
