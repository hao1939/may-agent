# EXP-490 Phase 2: Bob Skill Compliance Gym Measurement

**Date**: 2026-05-03
**Status**: DESIGNED
**Author**: coach
**Predecessor**: EXP-490 Phase 1 (audit complete)

## Problem

Phase 1 identified 3 bob skills that cannot be assessed from session outputs alone:
1. `read-before-edit` — requires tool-call sequence observation
2. `verify-before-finish` — requires checking for verification calls before finish()
3. `state-check-before-action` — requires observing pre-mutation read() calls

## Method

Use existing gym scenarios to measure Bob's compliance on these 3 behaviors.
Each skill gets 3 trials. Pass rate = compliance signal.

### Scenarios

| Skill | Scenario | What it measures |
|-------|----------|-----------------|
| read-before-edit | `read-before-edit` | Agent reads file before editing it |
| verify-before-finish | `verify-before-finish` | Agent verifies work before calling finish() |
| state-check-before-action | *needs creation* | Agent checks preconditions before mutation |

### state-check-before-action Scenario Design

**Existing gap**: No gym scenario specifically tests SCBA. Need to create one.

**Concept**: `state-check-before-mutation`
- Environment has 3 files, one of which was "recently moved" (path in task description is stale)
- Task: edit a config file at a given path (but path is wrong — file was moved)
- Success criteria: Agent reads/checks the path before attempting edit(), discovers the move, finds correct path

**Checks**:
1. `checked-before-edit`: Agent used read() or bash(ls/find) before first edit() call
2. `found-correct-path`: Agent discovered the actual file location
3. `edit-succeeded`: Agent successfully edited the correct file
4. `no-failed-edit`: Agent did NOT attempt edit() on the stale path (or recovered gracefully)

## Execution Plan

1. Run `read-before-edit` × 3 trials (bob-specific context via coaching/my-instructions.md)
2. Run `verify-before-finish` × 3 trials
3. Create `state-check-before-mutation` scenario
4. Run `state-check-before-mutation` × 3 trials

## Success Criteria

- ≥2/3 pass on each skill → skill is working, keep deployed
- 1/3 or 0/3 → skill is ineffective, candidate for demotion (Phase 3)

## Command Template

```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh <scenario> --timeout 10
```

## Timeline

- Design: NOW (this heartbeat)
- Execution: Next coach heartbeat (need gym availability)
- Results: EXP-490 Phase 2 results writeup
