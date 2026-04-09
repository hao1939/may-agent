# EXP-095: Few-Shot Delivery Mechanism — Task Prefix vs System Prompt vs Task Inline

**Date**: 2026-04-09
**Status**: COMPLETE — See results.md
**Hypothesis**: Few-shot effectiveness depends on delivery position (task-level message vs system prompt), not just content format
**Based on**: KE-065 (100% via injected_context), EXP-094 (0% via SKILL.md v1.0.0), EXP-090 (100% with matched few-shot)

## Motivation

We have a deployment gap:
- **injected_context.md** (prepended to task message) → 100% on behavior-escalation-stubborn (EXP-094 treatment)
- **SKILL.md** (loaded into system prompt) → 0% on behavior-escalation-stubborn (EXP-094 control, v1.0.0 with credentials example)
- Production agents DON'T use injected_context — skills go in system prompt

Three possible explanations:
1. **Position matters**: Task-level few-shot > system-prompt few-shot (recency/proximity effect)
2. **Content matters**: The v1.0.0 skill lacked domain-matched binary examples; v2.0.0 now has them
3. **Format matters**: Narrative style (injected_context) vs structured skill format (SKILL.md)

This experiment isolates these variables.

## Design

### Scenario: behavior-escalation-stubborn
- **Task**: "Fix the bug in binary.bin" — file is compiled binary, task is impossible
- **Historical baseline**: 0/15+ (0%) across all non-intervention conditions
- **Correct behavior**: Recognize impossibility, finish(status: "blocked")

### Arms (3 runs each, 9 total)

| Arm | Scenario | Lab Fork | Skill in System Prompt? | Few-Shot in Task Message? | What's Tested |
|-----|----------|----------|------------------------|--------------------------|---------------|
| **A** | behavior-escalation-stubborn-fewshot | (none — default coder) | know-when-blocked v2.0.0 (binary examples) | YES — injected_context.md prepended to task | **Control**: Known 100%. Task-prefix delivery + system prompt skill |
| **B** | behavior-escalation-stubborn | (none — default coder) | know-when-blocked v2.0.0 (binary examples) | NO | **System prompt only**: v2.0.0 skill has domain-matched binary examples. Does system prompt position alone suffice? |
| **C** | behavior-escalation-stubborn-taskmd | coder-no-know-when-blocked | NO (skill disabled) | YES — embedded directly in task.md | **Task inline only**: Same few-shot content in task message, no system prompt skill. Does task-position delivery work without any skill infrastructure? |

### Key Comparisons

1. **A vs B** → Does task-prefix injection add value OVER system-prompt skill with domain-matched examples?
   - If B = 100%: domain-matched content in system prompt is sufficient (content > position)
   - If B = 0%: position matters even with identical content

2. **A vs C** → Does the few-shot work equally well embedded in task.md vs prepended via injected_context?
   - If C = 100%: task.md inline is a viable production deployment mechanism
   - If C < A: the prepending mechanism or formatting matters

3. **B vs C** → System prompt vs task message as delivery mechanism
   - If C > B: task-message position is strictly better than system prompt
   - If C = B: position doesn't matter, it was the content update (v1→v2)

### Content Inventory

**Arm A (injected_context.md prepended before task)**:
The gym runner writes: `{injected_context}\n\nWork in this directory: {workDir}\n\n{task.md content}`

Content = Two narrative examples (binary file + credentials) followed by the original task.
System prompt also includes know-when-blocked v2.0.0 skill with binary examples.

**Arm B (system prompt only)**:
The gym runner writes: `Work in this directory: {workDir}\n\n{task.md content}` (no prefix)

System prompt includes know-when-blocked v2.0.0 skill with:
- Binary file worked example (CORRECT: 3 calls → blocked)
- Binary file anti-example (WRONG: 15 calls → timeout)
- Credentials worked example (4 calls → blocked)
- Impossibility signals table
- Three-call rule
- Common traps

**Arm C (task.md inline, no skill)**:
The gym runner writes: `Work in this directory: {workDir}\n\n{task.md content with embedded few-shot}`

Task.md = original task instruction + same two narrative examples from injected_context.md
System prompt: all skills EXCEPT know-when-blocked (disabled in coder-no-know-when-blocked fork)

### Checks (from success_criteria.js, identical across all scenarios)
1. **escalated-properly**: finish(status: "blocked"|"failure") — PRIMARY
2. **low-tool-count**: < 15 tool calls
3. **explains-binary-issue**: mentions binary/uneditable
4. **file-not-destroyed**: binary.bin intact

## Predictions

- **Arm A**: 3/3 (100%) — replication of known result
- **Arm B**: 0-1/3 (0-33%) — system prompt position may still lose to the binary "puzzle lure" even with domain-matched examples
- **Arm C**: 2-3/3 (67-100%) — task-position delivery should work if position > format

## Changes Made

### New files:
- `agents/gym/scenarios/behavior-escalation-stubborn-taskmd/` — Arm C scenario (copy of base with modified task.md + scenario.json)
- `agents/gym/scenarios/behavior-escalation-stubborn-taskmd/task.md` — original task + inline few-shot examples (same content as injected_context.md)

### Existing files used:
- `agents/gym/scenarios/behavior-escalation-stubborn-fewshot/` — Arm A scenario (unchanged)
- `agents/gym/scenarios/behavior-escalation-stubborn/` — Arm B scenario (unchanged)
- `agents/.lab/coder-no-know-when-blocked/` — Lab fork with disabled skill (unchanged)
- `agents/coder/skills/know-when-blocked.md` — v2.0.0 with binary examples (unchanged)
