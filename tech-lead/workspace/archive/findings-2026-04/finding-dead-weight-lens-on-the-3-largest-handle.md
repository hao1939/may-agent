# Dead Weight Lens: 3 Largest Handlers

**Date**: 2025-01-20  
**Files**: convention-check.ts (1153L), agents-auto-commit.ts (722L), metrics-snapshot.ts (621L)  
**Total**: 2496 lines  
**Goal**: Find ≥200 removable lines

---

## 1. convention-check.ts (1153 lines) — Est. savings: ~100 lines

### 1a. Verbose C1_3_EXEMPT_PATTERNS list (convention-check.ts:62–87)
26-line regex array with extensive comments. Several patterns are overly specific and could be collapsed into fewer regexes. The comments on each pattern add ~10 lines of pure documentation that could be condensed.  
**Savings**: ~10 lines

### 1b. Duplicate retroactive fix blocks (convention-check.ts:180–218)
Two nearly identical retroactive fix blocks: one for interrupted sessions (lines 180–198) and one for orphan sessions (lines 200–218). Same logic, same SQL pattern, same update statement. Could be a single loop over both queries.  
**Savings**: ~15 lines

### 1c. C1.5 ghostDeliverables — overly defensive (convention-check.ts:451–526)
76-line function with extensive branching for edge cases (blocked, ✅ marker, missing result). Most branches just `continue`. The function could be simplified to: "if result contains 'Deliverables not found on disk' → violation, else pass."  
**Savings**: ~30 lines

### 1d. C12.1 sessionStart — massive orientation check (convention-check.ts:606–694)
89-line function with repeated pattern lists (CONTEXT_FILE_PATTERNS at 614–626, ORIENTATION_TOOLS at 636–640). The bash command stripping loop (convention-check.ts:659–671) with iterative prefix removal is over-engineered for what is essentially "does the command start with grep/ls/git".  
**Savings**: ~25 lines

### 1e. Inline SCHEMA_SQL in convention-check could be externalized
Not applicable here — convention-check doesn't have schema SQL. Skip.

### 1f. Lengthy JSDoc comments throughout
Block comments on almost every function (e.g., convention-check.ts:301–310 on C1.1, convention-check.ts:331–337 on C1.3). While useful, many restate what the convention ID already implies. Trimming to one-liners would save ~20 lines across the file.  
**Savings**: ~20 lines

---

## 2. agents-auto-commit.ts (722 lines) — Est. savings: ~80 lines

### 2a. resolveSharedConflict is massive (agents-auto-commit.ts:363–434)
72-line function handling a rare edge case (shared file conflicts). It has 5 separate try/catch blocks and handles: identical content, append-only files, non-append-only with .conflict file creation. This entire function fires only during cross-instance merge conflicts on shared files — extremely rare.  
**Savings**: Could be simplified but risky. ~15 lines from removing redundant null checks.

### 2b. mergeAppendOnly function (agents-auto-commit.ts:451–471)
21-line function for merging append-only files during conflicts. Rarely exercised. Not dead but extremely low-frequency.  
**Savings**: ~0 (keep for correctness)

### 2c. writeInstanceHeartbeat (agents-auto-commit.ts:479–499)
21-line function that writes a simple JSON file. Could be inlined or condensed.  
**Savings**: ~5 lines

### 2d. Duplicate commit logic: per-agent vs batch (agents-auto-commit.ts:541–588)
The per-agent loop (541–571) and batch commit (573–585) share staging/commit logic. Could extract a helper.  
**Savings**: ~15 lines

### 2e. buildCommitMessage over-engineering (agents-auto-commit.ts:149–182)
34-line function with multi-line fallback, global category aggregation, and subject line truncation. The multi-line path (lines 164–182) builds a summary + body with category aggregation — this is a commit message for an auto-commit. Simplify.  
**Savings**: ~15 lines

### 2f. classifyFile + describeCategory (agents-auto-commit.ts:101–131)
31 lines of if/switch chains. Could be a Map lookup.  
**Savings**: ~10 lines

### 2g. DEFAULT_CONFIG hardcoded (agents-auto-commit.ts:49–53)
Duplicates what's in instance-config.json. Minor but worth noting.  
**Savings**: ~0 (needed as fallback)

---

## 3. metrics-snapshot.ts (621 lines) — Est. savings: ~70 lines

### 3a. Duplicate regression checking: notifyOwnerOnRegression AND checkRegression (metrics-snapshot.ts:187–215 and 330–389)
Both called for every measured metric (see lines 498+510 for auto, 550+556 for cmd). `checkRegression` checks 7d average regression and fires alerts. `notifyOwnerOnRegression` checks previous-snapshot regression and emits breach events. **Both fire alerts for regressions but use different methodologies.** This is redundant — a single regression check with configurable comparison (7d avg vs previous) would suffice.  
**Savings**: ~40 lines (merge into one function)

### 3b. SCHEMA_SQL block (metrics-snapshot.ts:83–120)
38 lines of CREATE TABLE/INDEX statements. These run every invocation via `ensureTables`. The schema is stable — could be moved to a shared schema file or at minimum the indexes don't need IF NOT EXISTS every run.  
**Savings**: ~5 lines (minor)

### 3c. Backfill section 0 (metrics-snapshot.ts:417–470)
54-line block that checks for unresolved alerts without active requests. Constructs a temporary MetricRow object (lines 454–467) just to call emitMetricBreach. The MetricRow construction has 6 null fields — could use a simpler emit signature.  
**Savings**: ~15 lines

### 3d. Duplicate measurement loops: auto vs command (metrics-snapshot.ts:474–512 and 516–560)
The auto-measure and command-measure loops are structurally identical: measure → record snapshot → update current → notifyOwnerOnRegression → check one-off → checkThresholdAlert → checkRegression. Only the measurement step differs. Extract a `processMetric(metric, value)` helper.  
**Savings**: ~20 lines

---

## Summary

| File | Current | Est. Removable | After |
|------|---------|---------------|-------|
| convention-check.ts | 1153 | ~100 | ~1053 |
| agents-auto-commit.ts | 722 | ~80 | ~642 |
| metrics-snapshot.ts | 621 | ~70 | ~551 |
| **Total** | **2496** | **~250** | **~2246** |

**Confidence**: Medium-high. The 250-line estimate exceeds the 200-line target. Highest-value changes:
1. **Merge duplicate regression functions** in metrics-snapshot.ts (~40 lines)
2. **Collapse retroactive fix blocks** in convention-check.ts (~15 lines)  
3. **Simplify C1.5 ghostDeliverables** in convention-check.ts (~30 lines)
4. **Extract shared measurement loop** in metrics-snapshot.ts (~20 lines)
5. **Trim verbose comments/JSDoc** across all three files (~30 lines)

## Follow-up
These are refactoring opportunities — each should be a separate fix session with test verification that handler behavior is unchanged.
