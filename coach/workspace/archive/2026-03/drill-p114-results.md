# P114 Experience Replay Drill Results

## Drill 1: Explicit P114 instruction (from previous heartbeat H534)
- **Date**: 2026-03-14 ~21:20
- **Agent**: coder  
- **Task**: Explicit "DRILL: P114 Experience Replay Verification" with step-by-step P114 instructions in the prompt
- **Result**: ✅ PASS — Agent grepped ERROR_LOG, found past errors, stated how they'd avoid them
- **Finding**: Agent DOES comply when P114 is explicitly in the task prompt

## Drill 2: Organic P114 compliance test (H536)
- **Date**: 2026-03-14 ~21:35
- **Agent**: coder-p114-drill (fork of coder)
- **Session**: s_1773524313928_847
- **Task**: "Add a new security test to test/tools/security.test.ts..." (deliberately overlaps with past errors about security tests, MISAPPLIED_REFUSAL, SCOPE_MISMATCH)
- **Result**: ❌ FAIL — Agent did NOT:
  - Read heartbeat.md (Step 0)
  - Grep ERROR_LOG (Step 1 in heartbeat)
  - Mention any past errors
  - Agent jumped straight to reading source files and implementing
- **Root Cause**: Task was given directly, not via "[heartbeat]" prompt. Without reading the heartbeat, P114 Step 1 is never triggered.

## Analysis

The structural issue is that P114 is embedded in **heartbeat.md Step 1**, but heartbeat.md is only read when the task prompt starts with "[heartbeat]". Direct tasks bypass the heartbeat entirely.

### Options for Fix:
1. **SOUL.md reinforcement**: Add P114 as a SOUL-level constraint (always loaded, not dependent on heartbeat reading)
2. **System prompt injection**: Have infrastructure inject P114 reminder into every coder session
3. **Accept current state**: Heartbeat-triggered sessions DO comply; direct tasks are typically simpler (exercises, drills) where P114 is less critical

### Recommendation
Option 1 is best. Add a brief P114 reminder to SOUL.md under a "## Pre-Task Safety" section. This is always loaded at session start regardless of task type.

## Drill 3: Heartbeat-flow P114 compliance (H536)
- **Date**: 2026-03-14 ~21:42
- **Agent**: coder-p114-drill (fork of coder)
- **Task**: "[heartbeat] You are Coder..." (standard heartbeat prompt) with a security test task in todo.md
- **Result**: ✅ PASS — Agent:
  - Read heartbeat.md first
  - Followed Step 1: grepped ERROR_LOG.jsonl for security/test keywords
  - Found all 3 past errors (MISAPPLIED_REFUSAL, INSUFFICIENT_VERIFICATION, SCOPE_MISMATCH)
  - Stated how to avoid each before proceeding
  - Correctly identified the task was already done (prior drill had completed it)

## Summary: 3 Drills Completed

| Drill | Mode | Result | P114 Compliance |
|-------|------|--------|-----------------|
| 1 | Explicit P114 in prompt | ✅ PASS | Yes — when told to |
| 2 | Direct task (no heartbeat) | ❌ FAIL | No — skipped entirely |
| 3 | Heartbeat flow | ✅ PASS | Yes — heartbeat triggers it |

## Root Cause Confirmed
P114 compliance depends on the **task entry point**:
- **Heartbeat flow** → Reads heartbeat.md → Step 1 (P114) executes → PASS
- **Direct task** → Skips heartbeat → P114 never triggered → FAIL

## Structural Fix Needed
The coder's SOUL.md needs a brief P114 reminder so it fires regardless of entry point. This is a Growth Cycle candidate.

## Drill Count: 3/3 ✅ (Bob requested 3 drills minimum)
