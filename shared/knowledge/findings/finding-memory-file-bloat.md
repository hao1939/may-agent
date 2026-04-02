# Finding: Memory File Bloat — readMemoryEntries reads full file for last N

**Date:** 2026-03-18T23:19Z
**Severity:** Medium (disk I/O waste, potential OOM risk)

## Problem

`readMemoryEntries()` in `src/lib/persistence.ts` reads the ENTIRE `.jsonl` memory file into memory, parses every entry, then slices the last N entries. For agents with large memory files, this is extremely wasteful.

## Evidence

### Memory file sizes (active agents):
| Agent | File Size | Lines | Avg Line | memoryLimit | Useful Data | Waste Ratio |
|-------|-----------|-------|----------|-------------|-------------|-------------|
| evaluator | 29.3MB | 1,551 | 18.9KB | 5 | ~94KB | **311:1** |
| may | 5.6MB | 3,625 | 1.6KB | 20 | ~31KB | 181:1 |
| coach | 3.9MB | 1,704 | 2.3KB | 10 | ~23KB | 170:1 |
| bob | 3.7MB | 1,642 | 2.2KB | 20 | ~45KB | 82:1 |
| tech-lead | 3.3MB | 1,508 | 2.2KB | 20 | ~44KB | 75:1 |
| optimizer | 3.0MB | 1,027 | 2.9KB | 20 | ~59KB | 51:1 |
| amy-kimi | 1.9MB | 789 | 2.4KB | 20 | ~49KB | 39:1 |
| scout | 1.5MB | 667 | 2.3KB | 20 | ~46KB | 33:1 |
| qa | 1.2MB | 226 | 5.5KB | 20 | ~109KB | 11:1 |
| amy | 0.8MB | 260 | 3.1KB | 3 | ~9KB | 89:1 |

**Total active memory files: ~54.2MB**
**Total old/backup memory files: ~75MB more** (evaluator-c44.jsonl 25MB, evaluator-c43.jsonl 25MB, etc.)
**Grand total: ~129MB in memory files**

### Code path:
```typescript
// src/lib/persistence.ts
export function readMemoryEntries(persistDir, name, limit) {
  const entries = readJsonlFile<MemoryEntry>(memoryPath(persistDir, name));  // reads ALL
  if (limit !== undefined) {
    return entries.slice(-limit);  // discards 99%+
  }
  return entries;
}
```

## Impact

1. **I/O waste**: Every session startup reads and parses the full memory file. Evaluator reads 29MB to get 94KB.
2. **Growing unbounded**: Files never get truncated. Evaluator alone grew 29MB in ~2 days.
3. **Backup bloat**: 75MB of stale backup memory files (evaluator-c44, evaluator-c43, bob-c50, etc.)

## Recommended Fixes

### Fix 1: Tail-read optimization (quick)
Use `readLastNLines()` or read file backwards to get only the last N entries. Saves 99%+ of I/O.

### Fix 2: Memory file rotation (medium)
Add periodic rotation: when file exceeds 1000 lines or 2MB, write last N entries to a new file and archive the rest.

### Fix 3: Stale backup cleanup (quick)
Delete old backup memory files (evaluator-c44, evaluator-c43, bob-c50, etc.) — they total 75MB and serve no active purpose.

## Related
- Finding: meta.json cost tracking broken (same persistence.ts area)
- TODO: Memory Redesign Brief (addresses this at architectural level)
