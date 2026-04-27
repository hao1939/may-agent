# KE-411: Skill Framing is Task-Type Moderated — Constraints Help Procedural, Expansion Helps Creative

**Date**: 2026-04-27
**Source**: EXP-243
**Confidence**: Medium (3 trials/arm, 4 scenarios — directional but underpowered)
**Connects**: KE-403 (instruction collapse), EXP-243

## Core Finding

Constraint-style skill language ("never X", "always Y", "MUST Z") helps procedural/verification tasks but may hurt creative/diagnostic tasks. Wholesale reframing to expansion-style is harmful — control outperformed treatment 87.5% vs 66.7% aggregate.

## Evidence

- **optimize-deploy-config** (procedural): Control 3/3, Treatment 0/3 (−100pp). Constraints provide necessary procedural guardrails.
- **cascading-fix-trap** (creative/diagnostic): Control 2/3, Treatment 3/3 (+33pp). Expansion style preserves planning exploration.
- **knowledge-entry-creation**: Both at ceiling (100%). No differentiation.
- Length confound noted: constraint skills were ~2× longer than expansion rewrites.

## Mechanism / Why

KE-403's instruction collapse is **task-type moderated**:
- For creative tasks, constraints narrow the planning space prematurely → collapse
- For procedural tasks, constraints are *functional guides* (step ordering), not creativity limiters → no collapse

## Implications

### 1. Do NOT wholesale reframe skills to expansion style
The naive interpretation of KE-403 (all constraints bad) is wrong for agent skills. Procedural verification skills need imperative framing.

### 2. Consider hybrid framing for multi-purpose skills
Skills like error-handling contain both diagnostic advice (expansion-friendly) and procedural steps (constraint-friendly). Future rewrites should preserve constraint language for procedural components.

## Actionable

- Keep constraint framing for: coder-edit-discipline, state-check-before-action, verification, file-safety
- Consider expansion reframing for: error-handling diagnostic sections, obstacle-pivot reasoning
- Do NOT ship wholesale skill rewrites based on KE-403 alone

## Open Questions

- Is the effect driven by skill *length* rather than *style*? (expansion rewrites were shorter)
- Does the effect hold with N=5+ trials per arm?
- What's the optimal hybrid format (constraints for steps, expansion for reasoning)?
