# KE-229: Second-Look Verification Skill — Activation-Gap Fix

**Source**: EXP-229 (2026-07-28)
**Status**: PROMOTED (for activation-gap failures)

## Finding
A 4-question pre-completion checklist improves pass rates on "activation gap" judgment scenarios (+100pp on silent-data-corruption) but has zero effect on "reasoning chain gap" or "conceptual gap" failures.

## Taxonomy of Judgment Failures
| Type | Description | Skill helps? | Example |
|------|-------------|-------------|---------|
| **Activation gap** | Agent CAN do it, just doesn't think to | ✅ Yes | silent-data-corruption |
| **Reasoning chain gap** | Needs multi-step evidence trace | ❌ No | approach-validation-trap |
| **Conceptual gap** | Lacks domain mental model | ❌ No | build-activation-gap |

## Implication
Checklists/reminders only fix activation gaps. For reasoning/conceptual gaps, need different interventions (evidence hierarchy skills, domain model training).

## Artifact
`agents/bob/skills/second-look-verification.md`
