# Sprint 17 Plan — 2026-04-03

## Summary
Focus: Find and validate skills that improve non-ceiling scenarios. Two baselines confirmed as ceiling (stale-approach-fixation, search-strategy-escalation). Three promising non-ceiling scenarios identified.

## Completed This Session
1. ✅ **Baseline: stale-approach-fixation** → CEILING (7/7). Agent already reads workspace notes. No skill needed.
2. ✅ **Baseline: search-strategy-escalation** → CEILING (6/6). 3 search commands used. Efficient-file-reading skill already covers this.

## Queued Experiments

### Experiment A: incremental-context-loading skill → incremental-context-loading scenario
- **Status**: READY — baseline done (5/7), treatment needed
- **Baseline**: 5/7 — fails `reads-context-cache-first` and `reads-changed-file`
- **Skill**: `agents/shared/skills/incremental-context-loading/SKILL.md`
- **Hypothesis**: Skill teaches agent to check context-cache.md first and use stat to detect changes. Should fix both failing behavior checks.
- **Method**: Install skill into coder prompt, run same scenario
- **Expected**: 7/7 (fix B1 and B3)

### Experiment B: convention-verify-edit behavior → convention-verify-edit scenario
- **Status**: READY — 3 baselines done (all fail), treatment needed
- **Baseline**: Best was 4/5, worst 3/5 — consistently fails C3 (explicit JSON validation)
- **Skill**: `verify-after-edit` already installed but not triggering C3 behavior
- **Hypothesis**: Need to strengthen verify-after-edit skill to explicitly include `node -e JSON.parse(...)` validation step. Current skill says to validate but doesn't make it specific enough.
- **Method**: Revise skill wording → run scenario
- **Expected**: 5/5

### Experiment C: behavior-escalation-stubborn (0/15 passes)
- **Status**: INVESTIGATE — chronically failing, needs root-cause analysis
- **Baseline**: 0/15 passes across all attempts
- **Action**: Read the scenario's success_criteria.js to understand what checks fail and why. This scenario may need scenario fixes rather than skill injection.
- **Priority**: Lower — focus on A and B first

## Key Learnings
- The coder agent is already quite capable on "natural" behavior scenarios (workspace-notes, search-efficiency)
- The biggest gaps are in process/convention compliance (verify-after-edit, context-cache reading order)
- Skills need to be very specific about what tool calls to make — general guidance isn't enough when success criteria check for specific patterns
