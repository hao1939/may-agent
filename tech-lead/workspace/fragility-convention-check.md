# Fragility Lens: `agents/may/handlers/convention-check.ts`

**File**: 1153 lines — largest handler in `agents/may/handlers/`
**Date**: 2025-01-20

---

## (1) Distinct Responsibilities — 5 found

| # | Responsibility | Lines | Location |
|---|---------------|-------|----------|
| 1 | **Orchestration** — find unchecked sessions, load transcripts, store results | ~160 | `convention-check.ts:107-337` (create + runConventionChecks) |
| 2 | **Transcript parsing** — parse tool calls from raw transcript JSON | ~95 | `convention-check.ts:371-461` (loadToolCalls) |
| 3 | **12 individual check functions** — the core logic | ~500 | `convention-check.ts:498-945` (checkC1_1 through checkC12_1) |
| 4 | **Regression detection** — compare pass rates across time windows | ~60 | `convention-check.ts:1024-1086` (detectRegressions) |
| 5 | **Summary/report writing** — write markdown summary to disk | ~50 | `convention-check.ts:1088-1135` (writeSummary) |

**Split recommendation**: Extract responsibilities 3, 4, and 5 into separate modules:
- `convention-checks/rules.ts` — the 12 `checkC*` functions (~500 lines)
- `convention-checks/regression.ts` — detectRegressions (~60 lines)
- Keep orchestration + transcript parsing in the main file

This would reduce the main file from 1153 → ~350 lines.

---

## (2) Dead/Unreachable Code Paths

**No fully dead functions found.** All exported and internal functions are called. However:

- **Overly defensive early returns**: `checkC12_1_sessionStart` (`convention-check.ts:842-944`) is 100 lines with 6 separate early-return paths and iterative string stripping logic (`convention-check.ts:913-926`). The bash command normalization loop is complex for what it does — could be a shared utility.

- **Config bloat**: `C1_3_EXEMPT_PATTERNS` (`convention-check.ts:69-93`) has 16 regex patterns and growing. Comments suggest ad-hoc additions ("Fixes false positives on..."). This is a maintenance smell — each new false positive adds a pattern.

---

## (3) Cyclomatic Complexity

- **~105 if/else branches** across 1153 lines (measured via grep).
- Worst offenders:
  - `checkC12_1_sessionStart` (`convention-check.ts:842-944`): ~15 branches in 100 lines — checks orientation via context files, workspace patterns, orientation tools, workflow calls, and bash command parsing with iterative prefix stripping.
  - `checkC1_5_ghostDeliverables` (`convention-check.ts:616-670`): ~10 branches parsing finish() tool results for deliverable validation.
  - `checkC1_3_verifyWrites` (`convention-check.ts:529-578`): ~10 branches with exempt pattern matching.

---

## (4) Duplication with Other Handlers

- **`compliance-check.ts`** (`convention-check.ts` is imported at `compliance-check.ts:19`) is a thin wrapper that runs convention-check + standing-orders-check sequentially. No duplication — clean delegation.

- **`common-sense-audit.ts`** hardcodes the same convention ID list (`common-sense-audit.ts:22`) with a comment "Keep in sync manually" — fragile coupling but not code duplication per se.

- **`extractPath` / `extractBashCommand` / `normalizePath`** (`convention-check.ts:1137-1153`) are tiny utilities that are likely duplicated in `standing-orders-check.ts` (similar transcript-parsing handler). Worth extracting to shared module.

---

## Recommendations — ≥200 Lines Removable

| Action | Lines saved | Effort |
|--------|------------|--------|
| Extract 12 check functions to `convention-checks/rules.ts` | ~500 lines moved out | Medium |
| Extract `detectRegressions` + `writeSummary` to separate modules | ~110 lines moved out | Low |
| Extract `loadToolCalls` + utility functions to `convention-checks/transcript.ts` (shared with standing-orders-check) | ~100 lines moved out | Low |
| Consolidate `C1_3_EXEMPT_PATTERNS` into a config file or data table | ~25 lines | Low |

**Conservative target**: Moving checks + regression + summary = ~610 lines out of main file, leaving a ~350-line orchestrator. Even just extracting the check functions alone exceeds the 200-line target.

---

## Follow-ups (do NOT fix in this session)

1. Extract check functions to `convention-checks/rules.ts`
2. Share `loadToolCalls` and path utilities with `standing-orders-check.ts`
3. Convert `C1_3_EXEMPT_PATTERNS` from inline array to external config
4. Simplify `checkC12_1_sessionStart` bash normalization logic
