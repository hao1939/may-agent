# EXP-211: Tool Overuse Baseline Measurement

**Date**: 2026-07-28 | **Status**: CLOSED — baseline too low to justify intervention
**Hypothesis**: H-190 (Epistemic Pre-Check Reduces Tool Overuse)

## Phase 1: Baseline Sample

### Session 1: bob heartbeat (s_1776951403548_1273)
- **Total tool calls**: 32
- **Clearly unnecessary**: 4-5
  - Call 8 (`ls .state/hypotheses/`) duplicates info from call 4
  - Call 9 (`find ... grep hypoth`) redundant with call 8
  - Call 26 re-reads same file as call 20 (HB-2044)
  - Calls 23-25: three separate greps on same file, could be one
- **Unnecessary rate**: ~15%
- **Pattern**: Re-reading files already read, fragmented queries on same file

### Observations
- Most tool calls ARE necessary (environment discovery in heartbeat context)
- Unnecessary calls cluster around: (a) re-reading already-fetched info, (b) fragmented queries
- The 15% rate is lower than DD#864's findings suggest — possibly because our agents already have structured tasks
- The biggest waste may not be unnecessary calls but **overly granular** calls (3 greps instead of 1)

### Next Steps
- CLOSED: 15% unnecessary rate is too low to justify prompt-cost of an epistemic pre-check skill. The intervention would add ~50 tokens per call to save ~5 calls/session — net negative ROI.
- If future data shows waste >30%, revisit.
