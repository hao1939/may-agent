# Coaching Plan: Coder — Safe-Edit Exercise #2 (Multi-Site Edit in Large File)

**Date:** 2026-03-09
**Agent:** Coder
**Level:** L2, pass streak 1/3
**Previous session:** 2026-03-05 — PASS on single-line edit in 273-line file

## Weakness Targeted

**Multi-site safe editing discipline.** Exercise #1 (2026-03-05) verified Coder can safely handle a single edit in a large file using grep→line-range read→sed. This exercise escalates the challenge: 4 edits spread across a 496-line real source file (`src/persistence.ts`). The critical test is whether Coder applies the safe-edit workflow *consistently for every site* rather than reverting to write() after the first safe edit succeeds. The minor weakness noted in Exercise #1 — line-number-based sed (e.g. `35s/...`) — is particularly dangerous in multi-edit scenarios where earlier edits can shift line numbers.

## Target File

**`src/persistence.ts`** — 496 lines. Real production code. Contains interfaces, utility functions, a class, and type exports. No scaffold files created.

**Pre-exercise checksum:** `7b46f825fdf0766671b332f36bfe84cf`

## Exercise Design: 4 Targeted Edits

### Edit 1: Update JSDoc comment (line ~19)
**Location:** `PersistedSession` interface JSDoc (line 19)
**Task:** Change the JSDoc from `/** Serializable session record. */` to `/** Serializable session record stored as meta.json per session directory. */`
**Why this tests safe-edit:** Simple text substitution. Pattern-matchable. sed-friendly.
**Verification:** `grep -n "Serializable session record stored as meta.json" src/persistence.ts` should match line 19.

### Edit 2: Rename a constant in readJsonlFile (line ~82)
**Location:** `readJsonlFile` function, the `console.warn` message (line 82)
**Task:** Change the warning tag from `[persistence]` to `[persistence:jsonl]` in the console.warn call.
**Why this tests safe-edit:** String replacement inside a function body. The pattern `[persistence]` appears only once in the file. Tests pattern-based sed discipline.
**Verification:** `grep -n "persistence:jsonl" src/persistence.ts` should match exactly 1 line.

### Edit 3: Add a parameter with default value (line ~183-184)
**Location:** `readMemoryEntries` function signature (around line 183)
**Task:** Add a third parameter `includeCorrupted: boolean = false` to the function signature. The function signature should change from:
`export function readMemoryEntries(persistDir: string, name: string, limit?: number): MemoryEntry[]`
to:
`export function readMemoryEntries(persistDir: string, name: string, limit?: number, includeCorrupted: boolean = false): MemoryEntry[]`
**Why this tests safe-edit:** Modifying a function signature is a common real-world edit. The pattern is unique and sed-replaceable. Does NOT require changing the function body or callers (default value preserves backward compatibility).
**Verification:** `grep -n "includeCorrupted" src/persistence.ts` should match exactly 1 line around line 183.

### Edit 4: Add a JSDoc @returns tag (line ~264-265)
**Location:** `loadAllSessionMetas` function JSDoc (around line 264)
**Task:** Add a `@returns` tag to the JSDoc. Change:
```
/** Scan all session meta.json files (active + archived) and return a map.
 *  This is the replacement for reading the sessions section of registry.json. */
```
to:
```
/** Scan all session meta.json files (active + archived) and return a map.
 *  This is the replacement for reading the sessions section of registry.json.
 *  @returns Record mapping session IDs to their persisted metadata. */
```
**Why this tests safe-edit:** Multi-line JSDoc insertion. Requires adding a NEW line (not just replacing). Tests whether Coder uses `sed` with `a\` (append) or `i\` (insert) commands, or an appropriate alternative for line insertion.
**Verification:** `grep -n "@returns Record mapping session IDs" src/persistence.ts` should match exactly 1 line.

## Task Prompt (to send to Coder)

```
Make these 4 changes to `src/persistence.ts` (496 lines). Use safe-edit patterns — this file is too large for write().

1. **Line ~19**: Update the JSDoc comment on the `PersistedSession` interface from `/** Serializable session record. */` to `/** Serializable session record stored as meta.json per session directory. */`

2. **Line ~82**: In the `readJsonlFile` function, change the console.warn tag from `[persistence]` to `[persistence:jsonl]` — i.e., change `console.warn(\`[persistence] Skipping corrupted JSONL line in ${filePath}\`)` to `console.warn(\`[persistence:jsonl] Skipping corrupted JSONL line in ${filePath}\`)`

3. **Line ~183**: Add a parameter `includeCorrupted: boolean = false` to the `readMemoryEntries` function signature, after the existing `limit` parameter. The signature should become: `export function readMemoryEntries(persistDir: string, name: string, limit?: number, includeCorrupted: boolean = false): MemoryEntry[]`

4. **Line ~265**: Add a `@returns` line to the `loadAllSessionMetas` JSDoc. After the line `*  This is the replacement for reading the sessions section of registry.json. */`, insert a new line before the closing `*/` that says: ` *  @returns Record mapping session IDs to their persisted metadata. */` — so the closing `*/` moves to this new line.

After all edits, run `npx tsc --noEmit` and `npx vitest --run` to verify the file still compiles and all tests pass.
```

## Scoring Rubric (/10)

| Criterion | Points | How to verify |
|-----------|--------|---------------|
| Uses `grep -n` (or similar) to locate all 4 edit sites before editing | +2 | Watch tool calls — should see grep/search commands for each target pattern |
| Uses line-range reads (`read(path, startLine, endLine)`) to verify context around each edit site | +2 | Watch for `read` calls with startLine/endLine parameters covering each of the 4 areas |
| Uses `sed` with PATTERN matching (not line-number addressing like `19s/...`) for edits | +2 | All sed commands should use pattern anchors like `s/old/new/` not `Ns/old/new/` |
| Does NOT use `write()` on `src/persistence.ts` | +2 | **HARD FAIL if violated.** Any `write` call targeting persistence.ts = automatic 0/10 |
| All 4 edits correct, file intact (496 lines, no content loss), tsc + vitest pass | +2 | Verify with grep for each edit, `wc -l`, checksum of non-edited sections, tsc, vitest |

**Pass threshold:** 7/10
**Hard fail:** Any use of `write()` on the target file = 0/10 regardless of other criteria.

## Verification Commands (post-exercise)

```bash
# Verify all 4 edits landed:
grep -n "stored as meta.json per session directory" src/persistence.ts
grep -n "persistence:jsonl" src/persistence.ts
grep -n "includeCorrupted" src/persistence.ts
grep -n "@returns Record mapping session IDs" src/persistence.ts

# Verify file integrity:
wc -l src/persistence.ts  # Should be 497 (496 + 1 inserted line for @returns)

# Verify build:
npx tsc --noEmit
npx vitest --run
```

## Cleanup

Since there's no git in the container, save a backup BEFORE running the exercise:
```bash
cp src/persistence.ts src/persistence.ts.bak
```

After verification, restore:
```bash
cp src/persistence.ts.bak src/persistence.ts && rm src/persistence.ts.bak
```

## Notes

- Edit sites are at lines ~19, ~82, ~183, and ~265 — well spread across the 496-line file.
- Edit 4 (inserting a new JSDoc line) is the hardest because it requires line *insertion*, not just replacement. This is where Coder is most likely to fall back to write().
- The minor weakness from Exercise #1 (line-number-based sed) is directly tested: with 4 edits, using line numbers for early edits could shift line numbers for later edits.
- All edits are type-safe (tsc should still pass) and don't change runtime behavior (JSDoc changes + unused default parameter).
