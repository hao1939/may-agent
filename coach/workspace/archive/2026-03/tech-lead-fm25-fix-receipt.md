# Growth Receipt: tech-lead FM-2.5 (TOOL_SCHEMA_ERROR)

**Date**: 2026-03-20T12:13:00Z
**Target Agent**: tech-lead
**Error Pattern**: FM-2.5 (TOOL_SCHEMA_ERROR) — 11 occurrences
**Method**: Method #19 taxonomy → text-layer reinforcement (conditional guard)

## Error Analysis

### Pattern
Tech-lead called tools with empty/missing required parameters or wrong parameter names:
- `bash({})` — missing `command` (6x)
- `agents({})` — missing `action` (1x)
- `edit({limit, offset})` — wrong params, should be `oldText/newText` (2x)
- `bash({path, content})` — wrong params, should be `command` (2x)

### Timeline
| Date Range | FM-2.5 Count | Notes |
|-----------|-------------|-------|
| Mar 14 | 4 | Initial burst |
| Mar 15 | 5 | Heavy recurrence |
| Mar 17 | 1 | Single occurrence |
| Mar 18-20 | 0 | Natural improvement after coach review |

### Root Cause
Model-level parameter confusion when context is loaded or attention is split. Not a knowledge gap — the agent KNOWS correct syntax but fails under cognitive load.

## Intervention Applied

### Fork: `tech-lead-fm25-fix` (created and promoted same session)
1. **SOUL.md** (purely additive):
   - Updated recurrence count 10→11
   - Added `bash({"path", "content"})` anti-pattern to bash entry
   - Added `agents` entry with required `action` param
2. **LESSONS.md** (purely additive):
   - New "Tool Call Argument Integrity" section with all 6 wrong-pattern examples
   - Referenced concrete session IDs where failures occurred
   - Placed BEFORE Path & Tool Hygiene for visibility

### Previous Fork Attempt
A previous fork on 2026-03-17 was DISCARDED because it deleted 44 lines of FM-2.4 Outcome Verification Protocol. This fork was carefully designed as purely additive — verified by diff.

## Decision: PROMOTE ✅

**Rationale**:
1. Changes are purely additive (SOUL.md +1 line, LESSONS.md +11 lines)
2. No existing protections deleted (FM-2.2, FM-2.4 guards intact)
3. Low risk — at worst these text additions have no effect (per authority hierarchy, text coaching has 0% measured influence)
4. At best they reinforce the natural decline already observed
5. They serve as documentation with concrete failure examples

## Effectiveness Prediction
- **Expected impact**: LOW (text-layer coaching per authority hierarchy finding)
- **Monitoring**: Check FM-2.5 count at +7 days (by 2026-03-27)
- **Success threshold**: ≤1 FM-2.5 error in next 7 days
- **If threshold not met**: Consider Method #15 (workflow enforcement) or accept as model-level limitation
