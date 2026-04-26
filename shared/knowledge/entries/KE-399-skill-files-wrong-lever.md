# KE-399: Skill Files Are the Wrong Lever for Agent Behavioral Change

**Date**: 2026-04-26
**Source**: EXP-224, EXP-225, EXP-226, EXP-227, EXP-228, H-EXP-029
**Confidence**: High
**Connects**: KE-002, KE-123, H-EXP-028, H-EXP-029

## Core Finding

Skill files produce 0% marginal behavioral improvement when the agent's role context doesn't already support the target behavior. Five consecutive experiments adding skills to `coder` (EXP-224 through EXP-228) all returned 0% improvement on judgment tasks. Meanwhile, simply switching from `coder` to `tech-lead` on the same scenario (sql-injection-in-query-builder) produced a 0% → 100% improvement with no skill intervention.

## Evidence

| Experiment | Skill Added | Agent | Improvement |
|-----------|------------|-------|-------------|
| EXP-224 | Task compliance | coder | 0% |
| EXP-225 | Workspace enumeration | coder | 0% |
| EXP-226 | NPX avoidance context | coder | 0% (regression in one arm) |
| EXP-227 | Selective skill loading | coder | Stalled on infra |
| EXP-228 | Security awareness | tech-lead | 0% (already at 100% baseline) |

- Coder: 0/15 (0%) on sql-injection recognition across all skill conditions
- Tech-lead: 10/10 (100%) on same scenario, NO skills added
- This is consistent with KE-002 (text-based rules 0/57 for judgment failures)

## Mechanism / Why

Agent role context (system prompt, persona, context.md) establishes the agent's "mental model" of what matters. Coder is optimized for "fix bug, pass tests" — it literally stops once tests pass. Tech-lead has broader quality/security awareness baked into its identity. Skill files are ~75-1500 words appended to an already-large context — they get shallow-read at best (H-EXP-028 hypothesis) and don't override the agent's core behavioral frame.

## Implications

### 1. Stop adding skills as first intervention
Skills work for procedural compliance (process rules) but NOT for judgment/recognition tasks. Before adding a skill, check if the agent's role context already supports the behavior — if not, a skill won't help.

### 2. Agent selection is the primary behavioral lever
For judgment tasks, route to the agent whose role context aligns with the desired behavior. Don't try to teach coder to care about security — use tech-lead.

### 3. Role context transplantation is the next experiment
H-EXP-029 Phase 2: take the specific paragraph from tech-lead's context that enables security awareness and add it to coder's context.md. If this works, it proves role context > skills.

## Actionable

- When designing interventions, try agent selection FIRST, role context editing SECOND, skills LAST
- For gym experiments: always run a cross-agent comparison before testing skill-based interventions
- Update experiment design template to require "cross-agent baseline" step
- Coach/evaluator should flag "skill added to wrong agent" as an anti-pattern

## Open Questions

- Does role context transplant actually work? (H-EXP-029 Phase 2)
- Is this specific to judgment tasks, or does it hold for procedural tasks too?
- What's the minimal role context delta that enables recognition? (One sentence? One paragraph?)
- Does H-EXP-028 (shallow-read) explain WHY skills fail, or is it a separate issue?
