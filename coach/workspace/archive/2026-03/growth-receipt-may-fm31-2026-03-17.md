# Growth Cycle Receipt: may FM-3.1 Fix

**Date**: 2026-03-17T02:42Z
**Session**: s_1773715331430_95
**Agent**: may
**Error Pattern**: FM-3.1 (PREMATURE_TERMINATION / Ungrounded assertions)
**Occurrences**: 3 in last 7 days (2 of 3 occurred AFTER prior C36 fix on 2026-03-16)

## Root Cause Analysis
May makes system state assertions ("no active sessions", "all items triaged", "no signals pending") without sufficient evidence. Prior lesson C36 ("Verify Tool Output") was too vague — it said "state what output actually was" but didn't provide enforceable structure.

### Specific Failures
1. **s_1773668069798_73** (Mar 16): Claimed prior heartbeats triaged all items with no evidence beyond two reads
2. **s_1773711566987_1078** (Mar 17): Asserted "2 unchecked items" were non-dispatchable without marking done
3. **s_1773714917466_1179** (Mar 17): Concluded "No active sessions" from empty `ls` output without checking exit code or path

## Changes Applied
### SOUL.md — Rule 6 (Data Integrity Protocol)
Added "No assertion without positive evidence" requiring:
- Quote exact tool output
- Confirm exit code was 0
- Confirm path/command was correct
- Fallback: "I could not determine [X]" instead of asserting [X]
- Key phrase: "Absence of evidence is NOT evidence of absence"

### LESSONS.md — C36 Strengthened
Renamed to "Evidence-Before-Assertion" with:
- 4 specific forbidden patterns (❌)
- Required evidence format: "Tool output was: `[exact]` (exit code: N). Therefore: [conclusion]."
- 6x recurrence count noted

## Verification
- ✅ Rule 6 present in SOUL.md
- ✅ All 3 sub-requirements (quote, exit code, path) present
- ✅ Key phrase present
- ✅ C36 renamed and expanded in LESSONS.md
- ✅ 4 forbidden patterns present
- ✅ Required format present
- ✅ No regression: C29, C42, rules 1-5, identity all intact
- ✅ Diff shows exactly 2 changes: 7 new SOUL.md lines + 7 replacement LESSONS.md lines

## Status: PROMOTED
Fork `may-fm31-fix` created, trained, verified, promoted to `agents/may/`, and discarded.
