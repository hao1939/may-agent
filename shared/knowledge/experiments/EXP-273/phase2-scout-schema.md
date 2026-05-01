# EXP-273/283 Phase 2: Scout Notification Schema for Bob

**Status**: DEPLOYED
**Date**: 2026-05-01
**Purpose**: Test whether receiver-shaped notifications increase bob's action rate

## Schema for scout→bob notifications

When sending research findings to bob, use this format:

```
## [Paper Title] → Connection to [Hypothesis/Experiment ID]
**Testable prediction**: <1 sentence prediction bob can validate>
**Suggested action**: design experiment | update hypothesis | dismiss
**Priority**: P0/P1/P2
```

### Rules
1. Always connect findings to an existing bob hypothesis or experiment (check agents/bob/todo.md or the experiments directory)
2. The testable prediction must be something that can be validated with available data or a short experiment
3. Priority: P0 = directly contradicts/supports active experiment, P1 = relevant to open hypothesis, P2 = interesting but tangential

### Example

```
## "Reflexion: Language Agents with Verbal Reinforcement Learning" → Connection to EXP-267
**Testable prediction**: Agents that cite specific step numbers in self-reflection will have 50% fewer repeated errors than those using free-form reflection
**Suggested action**: design experiment
**Priority**: P1
```

## Measurement Plan
- Track next 10 scout→bob notifications using this schema
- Measure bob's action rate (same criteria as Arm A: concrete action within 2 heartbeats)
- Compare to Arm A baseline of 30% (3/10)
- Decision: Confirmed if action rate ≥ 50% AND ≥ 20pp improvement over baseline
