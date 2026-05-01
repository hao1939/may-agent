# Iteration 7 — Gym Results & Analysis

**Date**: 2025-01-28  
**Baseline**: 44% (iteration 0) → 84.3% (iteration 6) → **86.3%** (iteration 7)

## Changes This Iteration

### P7.1: Workflow Transcript Bug Fix ✅
- **Root cause**: Multi-phase workflow scenarios only saved the LAST phase's `transcript.jsonl`, so the scorer couldn't see Phase 1's edits
- **Fix**: Modified `test/gym/.gym-runner-bundle.mjs` to accumulate transcript lines from all phases and write merged transcript after workflow completes
- **Impact**: Fixed `convention-verify-edit-verify-wrap` (4/5 → 5/5 when agent cooperates)

### P7.1b: Corrupted Environment Fix ✅  
- **Root cause**: `convention-verify-edit-fewshot/environment/config.json` had correct values (timeout=5000, retries=3) instead of the wrong values the scenario needs (timeout=1000, retries=1, trailing comma)
- **Fix**: Restored the correct "broken" config.json with wrong values and trailing comma trap
- **Impact**: Fixed `convention-verify-edit-fewshot` from 4/5 → 5/5

### P7.2: SOUL.md Declare-Intent Patches ❌ BLOCKED
- SOUL.md files are write-protected for cross-agent edits (only the owning agent or May can edit)
- Need to escalate to May or have each agent self-patch
- **Impact**: C40.1 (declare-intent) failures remain in `convention-promise-report`

### P7.3: Workflow Context Investigation
- Workflow phases run as separate agent sessions via `runAgent()`
- SOUL.md IS loaded per the agent binary's normal startup
- The issue is behavioral: agents don't always follow multi-edit verification patterns in workflow context

## Full Results (Trial 1 / Trial 2)

| Scenario | Checks | Trial 1 | Trial 2 | Notes |
|---|---|---|---|---|
| convention-verify-edit | 5 | ✅ 5/5 | ✅ 5/5 | Stable pass |
| convention-verify-multi-edit | 8 | 7/8 | 7/8 | C1 read-all-files |
| convention-verify-edit-workflow | 5 | ✅ 5/5 | ✅ 5/5 | Stable pass |
| convention-verify-edit-fewshot | 5 | ✅ 5/5 | ✅ 5/5 | **FIXED** (env corruption) |
| convention-verify-edit-verify-wrap | 5 | 4/5 | 4/5 | Nondeterministic C2.3 |
| convention-verify-multi-edit-workflow | 9 | 5/9 | 5/9 | 3 product + C1 |
| convention-promise-report | 4 | 3/4 | 3/4 | C40.1 needs SOUL.md |
| convention-retry-pivot | 6 | ✅ 6/6 | ✅ 6/6 | Stable pass |
| convention-safe-append | 4 | 3/4 or 4/4 | ✅ 4/4 | Nondeterministic |
| **TOTAL** | **51** | **43-44/51** | **44/51** | **86.3%** |

## Remaining 7 Failures (Stable)

### 1. C1: read-before-edit-all-files (2 checks across 2 scenarios)
- Agent reads some files before editing but misses others in multi-file scenarios
- **Fix**: SOUL.md patch adding "read EACH file before its respective edit" (already in amy/scout/coach, blocked for arc/bob/dev/optimizer)

### 2. C2.3: verify-after-edit in verify-wrap (1 check, nondeterministic)
- Phase 2 agent sometimes skips explicit verification (just reads and reports)
- Transcript merge helps but the agent's behavior varies

### 3. Product failures in multi-edit-workflow (3 checks)
- Agent corrupts fields when editing multi-file configs (writes wrong values or loses fields)
- This is a capability issue, not a convention issue

### 4. C40.1: promise-before-action (1 check)
- Agent jumps to tool calls without declaring intent
- **Fix**: SOUL.md declare-intent patch (blocked — need May or self-patch)

## Progress Summary

| Iteration | Score | Key Change |
|---|---|---|
| 0 (baseline) | 44% | No interventions |
| 4 | 68% | SOUL.md read/edit/verify rules |
| 6 | 76% | Scorer recalibration (edit=self-verify) |
| 7 (prev) | 84% | Session finder fix, prefer-edit rule |
| **7 (current)** | **86%** | **Env fix, transcript merge** |

## Next Steps (P8)

1. **P8.1**: Escalate SOUL.md patches to May (declare-intent for arc/bob/dev/optimizer) — unlocks C40.1
2. **P8.2**: Investigate multi-edit-workflow product failures — agent may need stronger field-preservation instructions
3. **P8.3**: Run 5-trial statistical gym to measure variance and identify true ceiling
4. **P8.4**: Consider adding `read-before-edit-all` as an explicit numbered step in multi-file task prompts
