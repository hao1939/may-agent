# EXP-097: Simulated Positional Privilege in System Prompt

**Date**: 2026-04-09
**Status**: RUNNING
**Hypothesis**: Framing few-shot examples as a "Current Situation Briefing" at the END of the system prompt can recover the positional privilege effect, making system-prompt few-shot as effective as task-message delivery.

## Background

EXP-096 proved that delivery position (system prompt vs task message) determines few-shot effectiveness, not prompt length. The model treats system prompt as "general rules" and task message as "what to do NOW."

This experiment tests whether we can hack around this by framing the few-shot as urgent/immediate within the system prompt itself.

## Design

**Scenario**: behavior-escalation-stubborn (binary file task)
**Base fork**: coder-minimal-exp097 (copied from coder-minimal-exp096)

### Arm A (control): Minimal coder + few-shot in injected_context.md
- Same as EXP-096 Arm C — replication
- Lab fork: coder-minimal-exp096 (unchanged minimal SOUL)
- Few-shot delivered via injected_context.md (task message)
- Expected: 3/3 pass

### Arm B (treatment): Minimal coder + few-shot in SOUL.md end
- Lab fork: coder-minimal-exp097 (SOUL.md modified)
- Few-shot appended to END of SOUL.md under "## Current Situation Briefing" with "**IMPORTANT — Read this before starting your task.**"
- No injected_context.md
- Expected: unclear — this is what we're testing

### Variables
- **Independent**: Position of few-shot (task message vs system prompt end with urgency framing)
- **Controlled**: Same few-shot content, same task, same base agent, same scenario infrastructure
- **Dependent**: Pass rate (4/4 criteria), duration, tool count

3 runs per arm = 6 total gym runs.

## Commands

```bash
# Arm A (control)
scripts/gym-run.sh exp097-arm-a --lab coder-minimal-exp096

# Arm B (treatment)
scripts/gym-run.sh exp097-arm-b --lab coder-minimal-exp097
```

## Files

- `agents/.lab/coder-minimal-exp097/SOUL.md` — Modified with "Current Situation Briefing" appended
- `agents/gym/scenarios/exp097-arm-a/` — Control scenario with injected_context
- `agents/gym/scenarios/exp097-arm-b/` — Treatment scenario without injected_context
