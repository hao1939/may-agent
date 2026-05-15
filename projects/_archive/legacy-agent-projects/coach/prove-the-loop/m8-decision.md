# M8: Promote/Reject Decision

**Date**: 2026-06-23
**Decision**: REJECT procedural discovery skill. CLOSE project with meta-finding.

## Rationale

The Data Flow Audit / Procedural Discovery skill showed 0% improvement over baseline across two experiments (EXP-195: 0/6, EXP-198: 0/20). The skill is rejected per the pre-registered criteria (0/10 = reject).

## What We Learned Instead

The project succeeded at its meta-goal: **proving whether the training loop works**. Answer:

1. **The loop methodology is sound.** We identified a real gap (relational bug blindness), designed controlled experiments, ran them with sufficient N, and got clear results.
2. **Text skills have a boundary.** They work for implementation tasks but not recognition/discovery tasks. This is a fundamental finding about the training method itself.
3. **Structural interventions needed.** For recognition bottlenecks, the system needs workflow-level or tool-level changes (e.g., auto-surface related files), not more text in context.

## Promoted Knowledge

- KE-338: Procedural discovery skills don't help find relational bugs
- Extends KE-054: Recognition-bottleneck tasks don't respond to text skills
