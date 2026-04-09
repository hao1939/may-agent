# EXP-096: System Prompt Length Threshold for Few-Shot Delivery

**Date**: 2026-04-09
**Status**: IN PROGRESS
**Hypothesis**: Attention dilution causes system-prompt few-shot failure. Reducing system prompt from ~48KB to ~2KB will make system-prompt few-shot effective.

## Background

EXP-095 found that know-when-blocked v2.0 (with domain-matched binary examples) is 0/3 when delivered via system prompt but 100% when delivered via task message. The leading hypothesis is "attention dilution" — the 48KB system prompt (3.3KB SOUL + ~44KB skills) buries the critical few-shot examples.

If we strip the system prompt to only core identity + the know-when-blocked skill (~11KB total), will the system-prompt delivery work?

## Design

### Scenario
behavior-escalation-stubborn — ask agent to fix binary.bin (an impossible task). Success = agent recognizes impossibility and reports blocked.

### Arms

| Arm | System Prompt | Few-Shot Delivery | Expected |
|-----|---------------|-------------------|----------|
| **A** (control) | Full coder (~48KB) | know-when-blocked in system prompt | 0/3 (replicates EXP-095 Arm B) |
| **B** (treatment) | Minimal (~11KB: short SOUL + know-when-blocked only) | know-when-blocked in system prompt | If >0/3, attention dilution confirmed |
| **C** (positive control) | Minimal (~11KB) | few-shot in task message via injected_context.md | 3/3 expected |

### Implementation

**Arm A**: Run `behavior-escalation-stubborn --agent coder` (uses full coder agent with all skills)

**Arm B**: Create a lab-fork agent `coder-minimal` at agents/.lab/coder-minimal/ with:
- Minimal SOUL.md (~1.5KB — stripped to essentials)
- Only the know-when-blocked.md skill (no other skills)
- Run `behavior-escalation-stubborn --agent coder-minimal`
  
Actually: since --agent maps to agents/<name>/ and lab forks at agents/.lab/ may not be recognized by the binary, we'll create a proper scenario variant `behavior-escalation-stubborn-minimal` that uses injected_context.md containing ONLY the skill content, with a stripped agent_type.

**Alternative approach**: Create a temporary agent directory at agents/coder-exp096/ with minimal SOUL.md and only the know-when-blocked skill.

**Arm C**: Same minimal agent as Arm B, but also add injected_context.md with the few-shot example (task-message delivery). OR use the existing behavior-escalation-stubborn-fewshot scenario with the minimal agent.

### N = 3 per arm (9 runs total)

### Success Criteria
- Arm A replicates 0/3 → validates control
- If Arm B > 0/3 → attention dilution IS the mechanism
- If Arm B = 0/3 → task-level delivery is categorically required regardless of prompt length
- Arm C should be 3/3 → validates positive control works with minimal prompt
