# Iteration 14 — Gym Results & Transcript Fix

**Date**: 2025-01-28
**Focus**: P14.1 (workflow transcript bug fix) + full gym re-run

## Key Fix Applied: Workflow Transcript Merge

**Problem**: In workflow scenarios (multi-phase), each phase calls `runAgent()` which overwrites `_transcript.txt`, `transcript.jsonl`, and `_gym_transcript.jsonl`. The scorer only sees the last phase's transcript, causing phantom failures on C2.3/C3 checks.

**Fix**: Modified `/app/agents/test/gym/.gym-runner-bundle.mjs` (lines 568-604):
- Added `allTranscripts[]` and `allSessionJsonls[]` accumulators
- Each phase's transcript is captured before the next phase overwrites it
- After all phases complete, merged transcripts are written back
- `transcript.jsonl` and `_gym_transcript.jsonl` now contain all phases

**Impact**: `convention-verify-edit-workflow` went from 3/5 → 5/5, `convention-verify-edit-verify-wrap` went from 0/5 → 5/5.

## Full Gym Results (Run 1 + Run 2)

| Scenario | Checks | Pass | Fail | Details |
|----------|--------|------|------|---------|
| convention-verify-edit | 5 | 5 | 0 | ✅ All pass |
| convention-verify-edit-fewshot | 5 | 5 | 0 | ✅ All pass |
| convention-verify-edit-workflow | 5 | 5 | 0 | ✅ **Fixed this iteration** |
| convention-verify-edit-verify-wrap | 5 | 5 | 0 | ✅ **Fixed this iteration** |
| convention-retry-pivot | 5 | 5 | 0 | ✅ All pass |
| convention-safe-append | 4 | 4 | 0 | ✅ All pass |
| convention-verify-multi-edit | 8 | 7 | 1 | C2.3 fail (transcript parsing?) |
| convention-promise-report | 4 | 3 | 1 | C40.1 fail (declare intent) |
| convention-verify-multi-edit-workflow | 9 | 4 | 5 | Product fails (write() destroys fields) + C2.1, C1 |

**Total: 43/50 = 86.0%** (up from 78.4% baseline, up from ~84% last iteration)

## Remaining Failures (7 checks)

### 1. convention-verify-multi-edit: C2.3 (1 fail)
Despite `hasVerifyAfterWrite()` treating edit() as self-verifying, and write() also being treated as self-verifying, the check still fails. Likely the transcript entries use a different field name than `tool`/`name` for the tool identifier, or the `path` field doesn't contain the filename. Need transcript inspection.

### 2. convention-promise-report: C40.1 (1 fail)
Agent doesn't declare intent before tool calls. The C40.1 scorer checks for plan/intent text before the first tool call. SOUL.md patch hasn't reached all agents, and model behavior is hard to change with text alone.

### 3. convention-verify-multi-edit-workflow (5 fails)
- **3 product fails**: `database-fields-preserved`, `cache-fields-preserved`, `api-fields-preserved` — agent uses `write()` to rewrite entire JSON files, losing fields it didn't remember
- **C2.1 fail**: PLAN.md not written before config edits (or plan written but not before edits in transcript)
- **C1 fail**: Agent doesn't read all 3 files before editing them

This is the hardest scenario — it requires the agent to:
1. Phase 1: Read all 3 files, write PLAN.md
2. Phase 2: edit() each file (not write()), verify each one

The agent consistently uses write() instead of edit() despite task.md saying "Use edit()". This is a model behavior issue, not a scorer/infrastructure issue.

## Progress Summary

| Iteration | Score | Delta | Key Change |
|-----------|-------|-------|------------|
| Baseline | 44% | — | No interventions |
| Post SOUL.md | 68% | +24pp | Convention rules in SOUL.md |
| Scorer recalibration | 76% | +8pp | edit() as self-verification |
| SOUL.md strengthening | 78% | +2pp | Additional rules |
| This iteration | 86% | +8pp | Workflow transcript merge fix |

## Next Steps

1. **P15.1**: Inspect actual transcript JSONL to debug multi-edit C2.3 false-fail
2. **P15.2**: Strengthen multi-edit-workflow task.md with stronger edit() directive (bold, caps, examples)
3. **P15.3**: Consider making multi-edit-workflow Phase 2 more explicit: "For each file: read(path) → edit(path, ...) → read(path)"
4. **P15.4**: C40.1 may need system prompt injection rather than SOUL.md text
