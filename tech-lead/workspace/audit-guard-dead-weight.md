# Lens C: Dead Weight Audit — Tool Guard System

**Date**: 2026-04-15  
**Scope**: `src/lib/tools/*guard*.ts`, `compose-guards.ts`, `index.ts`  
**Total LOC**: 2,988 (12 guard files + compose-guards + index)

---

## 1. Composition Architecture

Guards are wired in **two separate ways**:

### A. `composeGuards()` pipeline (in `manager.ts:381-403`)
10 guards composed as `beforeToolCall` hooks:
1. `empty-args-guard` (92 LOC)
2. `tool-schema-guard` (200 LOC)
3. `path-hallucination-guard` (202 LOC)
4. `completeness-guard` (193 LOC)
5. `finish-guard` (284 LOC)
6. `commit-guard` (121 LOC)
7. `verification-depth-guard` (457 LOC)
8. `read-dedup-guard` (82 LOC)
9. `session-read-guard` (122 LOC)
10. `scrape-dedup-guard` (84 LOC)

Plus `cost-limit-guard` (52 LOC) — auto-appended by `composeGuards()` itself.

### B. Inline call (NOT in the compose pipeline)
- `cross-edit-guard` (136 LOC) — called directly from `edit.ts:88` and `write.ts:101` via `checkCrossEditGuard()`. This is architectural, not dead — it runs at the tool execution layer, not the beforeToolCall hook layer.

---

## 2. Dead Code? → **None**

All 12 guard files are actively referenced:
- 10 guards → `manager.ts` → `composeGuards()` pipeline
- 1 guard (`cost-limit-guard`) → `compose-guards.ts` (auto-appended)
- 1 guard (`cross-edit-guard`) → `edit.ts` + `write.ts` (inline)

**No orphan guard files exist.**

Note: `index.ts` exports `cross-edit-guard` (line 3) but this is consumed by `edit.ts`/`write.ts` which import directly from the guard file, not via index. The index re-export is technically unnecessary but harmless (15 LOC file total).

---

## 3. Overlap Analysis

### 3a. `finish-guard` vs `verification-depth-guard` — **OVERLAP**
Both intercept `finish(status: "success")` and check for post-write verification:
- **finish-guard** (284 LOC): Checks for write evidence + at least one verification command after last write/edit. Source: FM-3.1/FM-2.2/FM-3.3 failures.
- **verification-depth-guard** (457 LOC): Also checks for post-write verification, plus detects git-on-gitignored-path patterns. Source: FM-3.3 failures.

The overlap is in "did verification happen after writes?" Both guards scan tool call history for write calls and subsequent verification calls. **741 LOC combined** for what could likely be a single guard.

**Severity**: Medium. Both run (composeGuards short-circuits on first block, so only one fires), but the code duplication increases maintenance burden and confusion about which guard owns what.

### 3b. `empty-args-guard` vs `tool-schema-guard` — **Intentional layering, not overlap**
- `empty-args-guard`: catches `read({})`, `bash({})` — missing args entirely
- `tool-schema-guard`: catches `read({command: "ls"})`, `bash({path: "file"})` — wrong args (cross-tool confusion), plus missing finish() fields

The tool-schema-guard header explicitly documents this boundary (lines 11, 25, 80, 86). This is well-designed complementary coverage.

### 3c. `read-dedup-guard` vs `session-read-guard` — **No overlap**
- `read-dedup-guard`: blocks reading the *same file* N+ times (any file)
- `session-read-guard`: blocks reading `session.jsonl` files specifically (huge files)

Different concerns. No overlap.

---

## 4. Value-to-LOC Ratio Assessment

| Guard | LOC | Value Signal | Rating |
|-------|-----|-------------|--------|
| `verification-depth-guard` | 457 | FM-3.3 prevention | ⚠️ Oversized |
| `finish-guard` | 284 | FM-3.1/FM-3.3 prevention | ⚠️ Overlaps with above |
| `path-hallucination-guard` | 202 | Blocks hallucinated paths | ✅ Justified |
| `tool-schema-guard` | 200 | Cross-tool confusion | ✅ Justified |
| `completeness-guard` | 193 | Optimizer-only, +100pp EXP-115 | ✅ Justified |
| `cross-edit-guard` | 136 | Agent isolation boundary | ✅ Justified |
| `commit-guard` | 121 | 74% auto-commit fix | ✅ Justified |
| `session-read-guard` | 122 | $2-5/session savings | ✅ Justified |
| `empty-args-guard` | 92 | 18+ wasted calls/day | ✅ Justified |
| `compose-guards` | 84 | Composition layer | ✅ Core infra |
| `scrape-dedup-guard` | 84 | 400KB+ savings | ✅ Justified |
| `read-dedup-guard` | 82 | $71/session savings | ✅ Justified |
| `cost-limit-guard` | 52 | Budget enforcement | ✅ Core infra |

### Lowest value-to-LOC: `verification-depth-guard` (457 LOC)
This is the largest single guard by far. It contains:
- `extractToolCalls()` — message parsing (lines 78-121)
- `isGitOnAgentsPath()` — git command detection (line 123)
- `isProcessArtifactWrite()` — process artifact detection (line 152)
- `isWriteCall()` / `isVerificationCall()` — tool classification (lines 175-227)
- `getReferencedPaths()` — path extraction (line 228)
- `detectGitOnGitignored()` — git-on-agents detection (line 255)
- `detectNoPostWriteVerification()` — main verification check (line 303)
- `createVerificationDepthGuard()` — factory (line 356)

Much of the tool-call parsing and verification detection logic duplicates what `finish-guard` also does. The git-on-gitignored detection is a unique feature but could be extracted to ~50 LOC.

---

## 5. Recommendations (for separate sessions)

### R1: Merge `finish-guard` + `verification-depth-guard` → single guard (~400 LOC, down from 741)
Both intercept finish(success) and scan for post-write verification. Merge them, keeping:
- finish-guard's write-evidence check
- verification-depth-guard's git-on-gitignored detection
- Shared tool-call parsing layer (extract once, used by both checks)

**Expected savings**: ~340 LOC, elimination of duplicated message parsing, single point of ownership for FM-3.3 prevention.

### R2: Remove `cross-edit-guard` re-export from `index.ts`
Line 3 of index.ts re-exports it, but consumers import directly. Harmless but misleading — suggests it's a "tool" export when it's actually a guard utility.

### R3: No guards to delete
All guards are actively wired and have documented incident/experiment sources. The system is lean — the only waste is the finish/verification overlap.

---

## Summary

- **Dead guards**: 0
- **Overlapping guards**: 1 pair (finish-guard + verification-depth-guard, 741 LOC combined)
- **Oversized guards**: 1 (verification-depth-guard at 457 LOC)
- **Recommended action**: Merge the overlapping pair (R1), saving ~340 LOC
- **Overall health**: Good. 11/12 guards have clear provenance and justified LOC.
