# Design: Reduce Skills Injection Overhead

**Status:** proposal  
**Author:** bob  
**Date:** 2026-04-19  
**Goal:** Reduce session startup overhead from ~25% to <10% by addressing #1 contributor: skills/*.md injection

## Problem

Every agent session injects ALL files from `agents/<name>/skills/*.md` into the system prompt unconditionally (manager.ts:462-476). This adds significant overhead:

| Agent | Skills Size | File Count |
|-------|------------|------------|
| bob | 35KB | 9 files |
| coach | 42KB | 8 files |
| optimizer | ~10KB | ~1 file |
| scout | ~10KB | ~1 file |
| tech-lead | ~10KB | ~1 file |

### Key waste patterns

1. **Duplication**: `evidence-over-narrative.md` (10KB) is identical (same md5) across 5 agents = 50KB total injected across the system, 10KB per session for each of those agents.

2. **Verbose skills**: Most skills contain 5-10KB of explanation/examples for 1-3 actionable rules. E.g., `read-before-edit.md` (2.7KB) → core rule is one sentence: "Always read() a file before edit()ing it."

3. **Unconditional loading**: ALL skills load for every session type. A read-only review session still gets `verify-after-edit.md`.

## Proposed Solution (3 tiers)

### Tier 1: Deduplicate shared skills (saves ~40KB across system)

Move `evidence-over-narrative.md` to `agents/shared/skills/`. Modify manager.ts to load shared skills first, then agent-specific skills. Each agent that currently has a copy gets a one-line symlink or the loader checks shared/ automatically.

**Code change** in manager.ts (~462):
```typescript
// Load shared skills first
const sharedSkillsDir = join(projectRoot, "agents/shared/skills");
// Then agent-specific skills (skip files already loaded from shared)
```

**Before:** 5 agents × 10KB = 50KB injected  
**After:** 10KB shared + 0KB per-agent = 10KB total (per-session: 10KB instead of 10KB, but prevents future drift/bloat)

### Tier 2: Compress skills to context.md entries (saves 20-30KB per agent)

Most skills can be distilled to 1-3 lines in `context.md` (which is already injected). The verbose skill files become reference docs in knowledge/ rather than always-injected system prompt content.

| Skill file | Current size | Compressed context.md entry |
|-----------|-------------|---------------------------|
| `read-before-edit.md` | 2.7KB | "MUST read() before edit() — top violation pattern" (already in context.md) |
| `verify-after-edit.md` | 2.7KB | "After editing, read the file to verify changes landed correctly" |
| `knowledge-base-navigation.md` | 5.3KB | "Always ls parent dir before reading files in agents/shared/knowledge/" (already in context.md) |
| `evidence-over-narrative.md` | 10KB | "When calling finish(): verification_evidence must cite specific tool outputs, not paraphrase" |
| `cross-reference-source-code.md` | 4.6KB | "Link knowledge entries to source code when relevant" |
| `gym-execution-checklist.md` | 0.9KB | Already in context.md |

**Bob before:** 35KB skills injection  
**Bob after:** ~8.6KB (read-only-finish-protocol.md kept as-is, rest compressed)  
**Savings:** ~26KB per bob session

**Coach before:** 42KB  
**Coach after:** ~7KB (infrastructure-map.md + work-session-scaffold.md kept, rest compressed)  
**Savings:** ~35KB per coach session

### Tier 3: Task-conditional skill loading (future)

Tag skills with applicable task types. Only inject skills matching the current session type.

```yaml
# In skill file frontmatter
applies_to: [edit, gym]  # skip for read-only, heartbeat
```

Not proposed for immediate implementation — Tier 1+2 should achieve the target.

## Expected Impact

| Metric | Before | After (Tier 1+2) |
|--------|--------|------------------|
| Bob system prompt skills | 35KB | ~9KB |
| Coach system prompt skills | 42KB | ~7KB |
| Shared duplication | 50KB (5×10KB) | 10KB (1×10KB) |
| Startup overhead % | ~25% | ~8-12% |

## Implementation Plan

1. Audit each skill file → extract core rules → add to context.md if not already there
2. Create `agents/shared/skills/` for deduplicated files
3. Update manager.ts to load shared skills, skip already-compressed ones
4. Remove redundant per-agent skill copies
5. Verify with session size measurements before/after

## Risks

- **Regression**: Compressed rules may lose nuance that prevents failures. Mitigation: keep verbose versions as knowledge/ reference, monitor failure rates for 1 week after change.
- **Cache invalidation**: Changing system prompt content invalidates KV cache for all agents. Mitigation: do all changes in one batch.
