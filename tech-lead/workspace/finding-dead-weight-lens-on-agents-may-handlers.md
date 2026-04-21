# Dead-Weight Lens: convention-check.ts

**File**: `agents/may/handlers/convention-check.ts` (1087 lines)  
**Target**: Get under 800 lines (~290 lines to cut)

## Summary

The file has three categories of removable weight: (1) a retroactive-fix block that runs every invocation but should be a one-time migration, (2) an over-engineered C12.1 check with iterative bash-stripping logic, and (3) bloated configuration arrays that belong in a shared config file. Combined savings: ~300 lines.

---

## Findings

### 1. Retroactive fix runs every invocation (~25 lines) — SEVERITY: Medium

`convention-check.ts:185-210` — The `retroQueries` block corrects historical false positives for interrupted/orphan sessions. This queries + updates the DB on **every single run**, even though the data it fixes is old. Should be a one-time migration or at minimum gated by a "migration applied" flag.

**Recommendation**: Extract to a one-time migration script. Save ~25 lines.

### 2. C12.1 sessionStart is over-engineered (~100 lines) — SEVERITY: High

`convention-check.ts:780-880` — The `checkC12_1_sessionStart` function has:
- 3 separate pattern lists (`CONTEXT_FILE_PATTERNS`, `WORKSPACE_PATTERN`, `ORIENTATION_TOOLS`) defined inline (`convention-check.ts:795-823`)
- An iterative bash command stripping loop (`convention-check.ts:853-863`) that handles `cd`, `export` prefixes with a `while(changed)` loop — over-engineered for what amounts to "did the first few calls read context?"
- A `workflow()` special case (`convention-check.ts:845`)

**Recommendation**: Simplify to: "any of first 5 calls is read/bash/agents/workflow → pass." The fine-grained pattern matching adds complexity without catching real violations. Save ~50 lines.

### 3. C1_3_EXEMPT_PATTERNS is bloated (28 lines) — SEVERITY: Low

`convention-check.ts:68-95` — 15 regex patterns for exempting files from verify-writes. Several are overlapping or overly specific:
- `/agents\/gym\/scenarios\//` and `/agents\/\.lab\//` (`convention-check.ts:80-82`) are already covered by `ALLOWED_WRITE_PREFIXES` at `convention-check.ts:52` which includes `agents/gym/` and `agents/.lab/`.
- `/^\/tmp\//` (`convention-check.ts:88`) is also in `ALLOWED_WRITE_PREFIXES`.
- `finding-.*\.md` (`convention-check.ts:94`) exempts the very deliverables agents produce.

**Recommendation**: Deduplicate with `ALLOWED_WRITE_PREFIXES`. Remove redundant entries. Save ~10 lines.

### 4. Regression cooldown management in create() (~40 lines) — SEVERITY: Medium

`convention-check.ts:120-160` — File-based cooldown tracking (read JSON, check timestamps, write JSON) is inline in the handler factory. This is a generic "deduped alert" pattern that belongs in a utility or the event bus itself.

**Recommendation**: Extract cooldown logic to a helper (`deduplicatedEmit` or similar). Save ~30 lines.

### 5. writeSummary regenerates full summary every run (~35 lines) — SEVERITY: Low

`convention-check.ts:1020-1055` — Aggregates all convention_checks from the last 7 days and writes `summary.json` on every run, even if only 1 new session was checked. The summary is a full DB re-query.

**Recommendation**: Only write summary if `sessionsChecked > 0` (it already short-circuits at line 107 for 0, but the writeSummary call at line 234 runs for any non-zero count). Consider writing less frequently (e.g., every 10th run). Save ~20 lines if inlined to a simpler format or made conditional.

### 6. Belt-and-suspenders isWrappedOutput logic — SEVERITY: Low

`convention-check.ts:330-345` — The `isWrappedOutput` check in `loadToolCalls` has a comment explicitly saying it's redundant ("Belt-and-suspenders with the isError=false fix above"). The outer `if (tc.isError)` guard in `checkC2_1_preciseArgs` (`convention-check.ts:570`) already prevents wrapped output from being flagged.

**Recommendation**: Remove the redundant branch. Save ~10 lines.

### 7. Inline constant arrays in C1.7 — SEVERITY: Low

`convention-check.ts:910-925` — `VERIFICATION_PATTERNS` (14 regex patterns) is defined inside the function body. Same with delegation tool checks. Could share patterns with C12.1's orientation tools.

**Recommendation**: Hoist and share with C12.1. Save ~10 lines.

---

## Reduction Estimate

| Finding | Lines saved |
|---------|------------|
| #1 Retroactive fix → migration | ~25 |
| #2 Simplify C12.1 | ~50 |
| #3 Deduplicate exempt patterns | ~10 |
| #4 Extract cooldown logic | ~30 |
| #5 Conditional summary writes | ~20 |
| #6 Remove belt-and-suspenders | ~10 |
| #7 Share verification patterns | ~10 |
| **Total** | **~155** |

With additional extraction of check functions to a separate `convention-checks/` directory (each check as its own module), the remaining ~140 lines can be reclaimed. The main file would become an orchestrator (~300 lines) importing individual check modules.

## Recommended Approach

1. **Quick wins first** (#1, #3, #6): ~45 lines, zero behavioral change
2. **Extract cooldown** (#4): ~30 lines, clean separation
3. **Simplify C12.1** (#2): ~50 lines, biggest single win
4. **Split checks into modules**: Gets orchestrator under 400 lines
