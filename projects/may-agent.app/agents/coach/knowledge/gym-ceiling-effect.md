# KE: Gym Ceiling Effect — Simple Scenarios Can't Test Compliance Under Load

**Source**: EXP-215, EXP-025
**Date**: 2025-07-21
**Status**: Verified

## Finding

Gym scenarios that isolate a single task consistently produce ceiling effects (100% compliance) even for behaviors that fail 40-55% of the time in production. This was observed in:

- **EXP-215**: QA finish() compliance — 100% in gym vs 45% in production
- **EXP-025**: 14/20 scenarios at ceiling

## Root Cause

Production failures in structural behaviors (finish(), verify-writes, etc.) are driven by **cognitive load**, not skill gaps:
- Multi-task heartbeats where finish gets deprioritized
- Context bloat crowding out instructions
- Time pressure / turn limits in complex sessions

Simple gym scenarios remove all of these pressures, so the agent always complies.

## Implication

**Don't use simple gym scenarios to test compliance-under-load behaviors.** Options:
1. Design multi-task pressure scenarios (give 3-5 tasks per session)
2. Test via production observation instead of gym
3. Use structural enforcement (workflow-level) instead of training

## Next Hypothesis

H-EXP-015: Multi-task pressure scenarios could bridge the gap between gym and production for compliance testing.
