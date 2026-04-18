# Growth Receipt: tech-lead FM-1.1 (Path Confusion)

**Date**: 2026-03-17
**Coach Session**: s_1773715308087_85
**Error Code**: FM-1.1
**Occurrences**: 7 in last 7 days
**Status**: ✅ PROMOTED

## Hypothesis
"If tech-lead has a concrete path pre-flight protocol with a known-wrong-paths table, it will stop guessing paths and eliminate ENOENT waste."

## Root Cause Analysis
All 7 FM-1.1 errors shared one root cause: **guessing file paths from memory/context instead of verifying via `ls`/`find` first**. Two sub-patterns:

1. **Environment paths (4/7)**: Using `cd /home/user`, `cd /Users/hao/...` — paths that don't exist in the container.
2. **File paths (3/7)**: Guessing `src/app/manager.ts` instead of `src/lib/manager.ts`, or reconstructing brief filenames incorrectly.

## Changes Applied
### SOUL.md
1. **Strengthened `cd` section**: Added specific failed paths with counts (was generic "9+ times", now lists exact paths: `cd /home/user` 6x, `cd /Users/hao/c/mcp-agent`, etc.)
2. **Replaced path verification bullet**: Expanded from 1 line to a full protocol with 3 concrete steps + known wrong→right path map table + mandatory self-check gate.

### heartbeat.md
3. **Added PATH PRE-FLIGHT section**: Added path verification to the environment reality check section that runs at session start, including the top 3 known traps.

## Verification
Structural verification — each of the 7 error instances maps to a specific countermeasure in the new rules:
- Errors #2/#3/#4: Listed as specific `cd` failure paths
- Errors #1/#5/#6/#7: Listed in Known Wrong→Right Path Map with exact wrong/right pairs
- Error #5 (substitution): Addressed by Protocol step 2 ("Do NOT guess a different path after ENOENT")
- Brief errors (#5/#7): Addressed by Protocol step 3 ("Run `ls agents/bob/workspace/brief-*`")

## Expected Impact
- Eliminate `cd /home/...` and `cd /Users/...` errors (already partially addressed, now with specific path evidence)
- Eliminate guessed-path ENOENT errors by making `ls`-first a mandatory gate
- Reduce turn waste from recovery-after-ENOENT pattern
