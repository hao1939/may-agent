# EXP-800 Run Plan — Threshold Rescue for Verify-After-Edit

**Status**: IN PROGRESS
**Started**: 2025-01-28
**Owner**: coach

## Overview

Testing whether concrete-threshold P0 rules (KE-715) can rescue VAE compliance even under distraction (testing KE-655).

## Scenario

`multi-file-refactor` — rename `calculateTotal` → `computeTotal` across 4 files.

## Arms & Schedule

| Arm | Variant | Sessions | Status |
|-----|---------|----------|--------|
| A | baseline | 5 | PENDING |
| B | vague-nudge | 5 | PENDING |
| C | concrete-threshold | 5 | PENDING |
| D | concrete-distractor | 5 | PENDING |

## Measurement Protocol

For each session, count:
1. Total edit()/write() calls
2. read() calls on same file within next 2 tool blocks
3. VAE rate = #2 / #1
4. Task success (all renames correct + tests pass)

## Decision Criteria

- Arm C ≥60% AND Arm D ≥60% → KE-715 dominates, promote concrete-threshold VAE
- Arm C ≥60% AND Arm D ≤25% → KE-655 dominates, threshold is gym-only
- Both ≤25% → VAE structurally untrainable via text

## How to Run

```bash
# Each arm runs via gym dispatcher:
# gym run multi-file-refactor --variant=baseline --count=5
# gym run multi-file-refactor --variant=vague-nudge --count=5
# gym run multi-file-refactor --variant=concrete-threshold --count=5
# gym run multi-file-refactor --variant=concrete-distractor --count=5
```

## Results Log

### Arm A — Baseline
| Session | Edits | Verified | VAE% | Task OK? |
|---------|-------|----------|------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Arm B — Vague Nudge
| Session | Edits | Verified | VAE% | Task OK? |
|---------|-------|----------|------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Arm C — Concrete Threshold
| Session | Edits | Verified | VAE% | Task OK? |
|---------|-------|----------|------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Arm D — Concrete + Distractor
| Session | Edits | Verified | VAE% | Task OK? |
|---------|-------|----------|------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
