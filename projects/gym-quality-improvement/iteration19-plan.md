# Gym Quality Improvement — Iteration 19 Plan

**Date**: 2026-09-04
**Status**: Ready to execute

## Current State (end of Iteration 18)
- 432 scenarios audited
- M6 (broken rate): 3.9% ✅ (target <5%)
- M7 (pre-solved rate): 9.0% (39/432, effective ~3.9% after removing legitimate restraint tests)
- 17 broken scenarios identified with exact root causes
- Phase 1 (infrastructure repair) complete → transitioning to Phase 2 (agent pass rates)

## Iteration 19 Objectives
1. **Batch-fix broken scenarios by root cause** (the 17 identified in iteration 18)
   - Missing dependencies (like better-sqlite3)
   - Invalid scenario.json configs
   - Broken success_criteria.js
2. **Run a pass-rate measurement** on 30 canonical scenarios to update M1
3. **Close the infrastructure repair milestone** if M6 stays <5% after fixes

## Root Cause Categories (from iteration 18)
Per the full audit, the 17 broken scenarios cluster into:
- Missing npm dependencies in environment/
- success_criteria.js referencing files that don't exist
- scenario.json pointing to nonexistent inherits targets
- Timeout too short for multi-phase workflows

## Priority
This is mechanical work with proven patterns from iterations 13-15. Each batch follows:
1. Identify the fix from root cause
2. Apply fix
3. Run scenario in stub mode to verify it doesn't crash
4. Move to next

## Blocked?
No — this is fully within coach's capability. Just needs execution time.
