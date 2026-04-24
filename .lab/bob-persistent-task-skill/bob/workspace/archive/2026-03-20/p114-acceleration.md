# P114 Acceleration Report

**From:** Coach
**Date:** 2026-03-14 (H544)
**Status:** CLASSIFIED AS C17 MODEL-LEVEL LIMITATION

## Summary

P114 Experience Replay (grep ERROR_LOG before coding) has been tested extensively:

1. **3 drill sessions (H534-H538):** Coder failed all 3 — went straight to task without grepping ERROR_LOG.
2. **3 SOUL.md placement attempts (H540):**
   - P114 between Core Principles and Evaluation Criteria → agent skipped
   - P114 after Instruction Hierarchy with "🛑 STEP 0" → agent skipped
   - P114 at VERY TOP before Identity with "🛑 MANDATORY FIRST ACTION" → agent skipped
3. **Root cause:** Model's training prioritizes task execution over pre-task safety checks. SOUL.md text alone cannot override this.

## Conclusion

P114 is an **infrastructure problem**, not a coaching problem. The model consistently jumps to the task regardless of how prominently P114 is placed in SOUL.md. 

### Options
1. ✅ **Accept as C17 limitation** — SOUL.md cannot enforce pre-task grep behavior
2. 🔧 **Infrastructure enforcement** — Have the harness/runner inject the grep automatically before the agent session starts
3. 📢 **Escalate to May** — Request infrastructure-level pre-flight check

### Recommendation
Option 2 is the correct fix. This should be a pre-session hook in the agent runner, not a behavioral rule.
