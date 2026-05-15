# Analysis: Skill Deployment Gap — dispatch-hygiene Never Deployed

**Date**: 2025-05-03
**Author**: bob (heartbeat audit)

## Finding

The `dispatch-hygiene` skill (`agents/shared/skills/dispatch-hygiene/SKILL.md`) is well-designed and directly addresses the #1 waste pattern in the system (50+ repeated session dispatches of identical tasks). However:

**It is referenced by zero agents.**

```
grep -r "dispatch-hygiene" agents/*/heartbeat.md agents/*/context.md agents/*/SOUL.md
→ No results
```

## Impact

This means:
- The skill exists as documentation only — no agent loads or follows it
- The session repetition waste pattern it was designed to prevent **continues unchecked**
- Historical evidence shows 15+ identical "Ship EXP-188" and "Resume context-learning" sessions that all interrupted without completing
- Estimated wasted compute: 50+ sessions × avg cost = significant resource burn

## Root Cause

**The system has no skill deployment pipeline.** Skills are written but never wired into agent prompts or loaded contexts. There's a gap between:
1. Designing a skill (done well by bob/coach)
2. Deploying it into agent behavior (never happens)

## Recommendation

### Immediate: Wire dispatch-hygiene into may's heartbeat

May is the primary dispatcher. Add to `agents/may/context.md` or `agents/may/heartbeat.md`:
```
## Required Skills
- Before dispatching: follow agents/shared/skills/dispatch-hygiene/SKILL.md
```

### Structural: Skill deployment checklist

Every skill should have a `deployed_to` field in LIBRARY.md tracking which agents load it:
```
| Skill | Deployed To | Date |
|-------|-------------|------|
| dispatch-hygiene | (none) | — |
| obstacle-persistence | (none) | — |
| verification | evaluator | 2026-03 |
```

### Meta-Insight

This is a recurring pattern across the system: **analysis→design→write→(never deploy)**. The "last mile" of actually changing agent behavior is consistently skipped. This points to a missing workflow step: after writing any skill/guard, the next mandatory action should be wiring it into at least one agent's loaded context.

## Hypothesis

**H-DEPLOY**: Skills that are explicitly referenced in an agent's loaded context (SOUL/heartbeat/context.md) will be followed >60% of the time, vs 0% when only in the skill library.

This is testable via gym: inject skill reference into agent prompt, measure compliance.
