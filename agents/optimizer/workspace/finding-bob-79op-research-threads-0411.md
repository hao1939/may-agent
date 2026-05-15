# Finding: Bob 79-op Research Thread Sessions (Apr 11)

**Date**: 2026-04-11  
**Investigator**: Optimizer (Mode C: Skill & Technique Scouting)  
**Sessions**: `s_1775946417531_1663` (79 ops), `s_1775946417555_1664` (79 ops)

## Summary

Two Bob KB-integration sessions hit 79 ops each — 3.2x the baseline average (24.6 ops for a full D-o-R run). Both were parallel research threads in the `parallel-research` workflow (run `wr_1775946417530_jnvr`), spawned from a heartbeat session doing todo.md trimming. The total workflow cost was **227 ops** across 4 child sessions (79+79+51+18) to integrate 6 experiments into the knowledge base — roughly **38 ops per experiment**, when 15-20 should suffice.

## Root Cause: Dual Reading Spiral (read + bash cat)

Both sessions exhibit the same pathological pattern: **reading the same files repeatedly via two different mechanisms** (the `read()` tool AND `bash cat/sed/grep`).

### Session 1664 (EXP-135 + EXP-140) — Detailed Breakdown

| File | read() calls | bash cat/sed | Total reads | Needed |
|------|-------------|-------------|-------------|--------|
| INDEX.md | 6 | 2 (cat) + 3 (sed) | 11 | 2 |
| PRIORITY-TRACKER.md | 6 | 3 (cat) + 1 (sed) | 10 | 2 |
| todo.md | 5 | 3 (cat) | 8 | 1 |
| EXP-135 results | 2 | 4 (cat) | 6 | 1 |
| EXP-140 results | 2 | 3 (cat) | 5 | 1 |
| **Total** | **21** | **19** | **40** | **7** |

**33 unnecessary file reads** — accounting for ~30% of the session's ops alone.

### Session 1663 (EXP-131 + EXP-134) — Same Pattern

| File | read() calls | bash cat/sed | Total reads | Needed |
|------|-------------|-------------|-------------|--------|
| INDEX.md | 9 | 4 (sed) | 13 | 2 |
| PRIORITY-TRACKER.md | 5 | 3 (sed/grep) | 8 | 2 |
| todo.md | 5 | 2 (cat) | 7 | 1 |
| EXP-131 results | 2 | 2 (head/cat) | 4 | 1 |
| **Total** | **21+** | **11+** | **32+** | **6** |

## Phase Breakdown (Session 1664)

| Phase | Turns | Tool Calls | Productive Calls | Waste |
|-------|-------|-----------|-----------------|-------|
| 1. Orientation (reading) | 1-8 | 26 | ~7 | ~19 (73%) |
| 2. Exploration (bash) | 9-36 | 62 | ~20 | ~42 (68%) |
| 3. Editing | 37-53 | 17 | ~14 | ~3 (18%) |
| 4. Verification | 54-60 | 6 | ~5 | ~1 (17%) |
| **Total** | **60** | **111** | **~46** | **~65 (59%)** |

**Key finding**: Phases 1 and 2 account for 88 of 111 calls (79%) but most of their work is redundant. Phase 3 (editing) is the only efficient phase at 82% productive.

## The Two Bloat Mechanisms

### 1. "Orientation Reading Spiral" (Phase 1)
After the initial read of 4-5 files, the model re-reads the same files 4-5 more times in rapid succession before doing anything. This appears to be a **context refreshing behavior** — the model reads files, then loses confidence it has the content, and reads again. Each turn reads 3 files in parallel (INDEX, PRIORITY-TRACKER, todo), repeating the identical pattern 5-6 times.

This spiral was present even in the "efficient" 22-op session (`s_1775874282768_1181` for EXP-129), which read INDEX.md 4x and PRIORITY-TRACKER.md 4x. It's a systemic Bob pattern.

### 2. "Bash cat as Shadow Read" (Phase 2)
After reading files via `read()`, the model then re-reads them via `bash: cat <file>`. This is doubly wasteful:
- The content was already available from `read()`
- `bash cat` doesn't provide the line numbers that `read()` gives
- Files like EXP-135 results were cat'd **4 additional times** after being read twice

## Why No Budget Cap Caught This

The `parallel-research` workflow injects thread tasks with this prompt:
```
## Research Thread: {label}
{task}
Write your findings to a file. Be thorough but focused on this specific thread.
```

**No budget cap, no phase structure, no efficiency guidance.** Compare with the D-o-R workflow which has `BUDGET: 15 TOOL CALLS MAX` for Phase 1. The research thread sessions have zero constraints.

## Comparison with Baselines

| Session Type | Ops/experiment | Notes |
|-------------|---------------|-------|
| D-o-R Phase 1 (with 15-op cap) | 7.2 | Very constrained |
| D-o-R full run (post-cap) | 24.6 | Avg across phases |
| Parallel-research thread | **39.5** | No cap (79 ops / 2 experiments) |
| EXP-129 single integration | **22** | No cap but simpler task |
| Theoretical ideal | **12-15** | Read inputs → edit targets → verify |

## Actionable Recommendations

### Fix 1: Add Budget Cap to parallel-research Thread Tasks (HIGH IMPACT)
Add a budget instruction to the thread task template in `parallel-research.ts`:

```typescript
const threadTask =
  `## Research Thread: ${label}\n\n` +
  `${thread.task}\n\n` +
  `**BUDGET: 40 TOOL CALLS MAX.** Read each file ONCE. Do not re-read files you've already seen. ` +
  `Plan your edits before starting. Verify with grep, not full re-reads.\n\n` +
  `Write your findings to a file. Be thorough but focused on this specific thread.`;
```

**Estimated savings**: 40-50% reduction per thread → ~20 ops/thread → **118 ops saved per 3-thread workflow** (from 227 to ~109).

### Fix 2: Anti-Spiral Instruction in Bob's System Prompt (MEDIUM IMPACT)
Add to Bob's task injection:
```
EFFICIENCY: Do not re-read files you've already seen in this session. 
Use grep for line lookups, not full file reads.
```

This addresses the systemic reading spiral that appears across all Bob sessions.

### Fix 3: Consolidate Experiments per Thread (LOW EFFORT)
Currently 3 threads × 2 experiments = 6 integrations. Could be 2 threads × 3 experiments. The fixed overhead per thread (reading INDEX, PRIORITY-TRACKER, todo) is ~10 ops. Fewer threads = less duplicated overhead.

**Estimated savings**: ~20 ops (one fewer thread overhead).

## Cost Estimate

At current rates, 79 ops ≈ 7 minutes of compute. The two sessions together cost ~14 minutes. With Fix 1 alone, this drops to ~7 minutes. With all three fixes, potentially ~5 minutes for the same work.

**Per-day impact**: If Bob runs 2-3 parallel-research workflows per day, Fix 1 alone saves 200-350 ops/day (~5-8% of total daily ops).
