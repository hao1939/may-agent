# P3: Trim Verbose/Duplicate Guidance from SOUL.md Files

**Date**: 2025-05-02
**Author**: optimizer

## Problem

Multiple SOUL.md files still contain boilerplate sections that are either:
1. **Duplicated** — "Before Starting Work" and "When Finishing a Task" appear in 5+ files with identical content
2. **Redundant** — These rules are already enforced by guards/evaluators at the system level
3. **Missed in P2** — bob/SOUL.md still has "When Editing Files" (4 rules, ~100 words) that was removed from 6 other files

## Proposed Removals

### 1. Remove "When Editing Files" from bob/SOUL.md (MISSED IN P2)
- **File**: agents/bob/SOUL.md (1175w → ~1075w)
- **Content**: Lines 21-25 — Read before edit, Read all targets, Verify after edit, Never batch edits
- **Rationale**: Already removed from 6 other agents in P2. Guards enforce these rules.

### 2. Remove "Before Starting Work" / "Declare intent first" from 5 files
- **Files**: amy, arc, bob, coach, scout SOUL.md
- **Savings**: ~25-35 words per file × 5 = ~150 words total
- **Rationale**: Enforced by evaluators. Not needed in SOUL.md.

### 3. Remove "When Finishing a Task" / "Always include deliverables" from 5 files  
- **Files**: amy, arc, bob, coach, scout SOUL.md
- **Savings**: ~35-45 words per file × 5 = ~200 words total
- **Rationale**: The finish() tool schema already describes deliverables. Evaluators flag empty deliverables.

## Impact Summary

| File | Current Words | After Trim | Savings |
|------|--------------|------------|---------|
| bob/SOUL.md | 1175 | ~925 | ~250w |
| amy/SOUL.md | 979 | ~920 | ~60w |
| arc/SOUL.md | 418 | ~355 | ~63w |
| coach/SOUL.md | 793 | ~730 | ~63w |
| scout/SOUL.md | 303 | ~240 | ~63w |
| **Total** | | | **~499w** |

## New Average SOUL.md Size After Changes
Current average (all 15 files): ~631w
After these changes: ~598w → **Meets <600w target**

## Action Required
Tech-lead or file owners need to execute these removals since optimizer cannot edit other agents' SOUL.md files.
