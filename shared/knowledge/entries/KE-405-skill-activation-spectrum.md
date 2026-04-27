# KE-405: Skill Activation Follows a Structural Enforcement Spectrum

**Source**: EXP-248 (Skill Activation Audit, observational, 156 sessions across 10 agents)
**Date**: 2027-08-02
**Confidence**: High (large sample, consistent pattern)

## Finding

Skill activation rates depend almost entirely on enforcement mechanism, not skill quality:

| Enforcement Level | Skill | Activation Rate |
|-------------------|-------|-----------------|
| **Structural (infra)** | Verify-Before-Finish | 90% |
| **Text (context.md)** | Read-Before-Edit | 57% |
| **Text (skill file)** | Verify-After-Edit | 22% |

## Implications

1. **Don't write more text skills.** Text-only skills cap at ~57% activation. The 22% VAE rate proves that even a well-validated skill (EXP-238/239/240) fails when it's just a `.md` file.

2. **Invest in structural enforcement.** VBF works at 90% because finish-guard blocks completion without verification. The mechanism, not the instruction, drives compliance.

3. **The skill pipeline should end in infrastructure**, not documentation. Validated skills should be promoted to structural enforcement (guards, templates, workflow steps), not just deployed as text.

4. **Agent variance is real but secondary.** qa/scout achieve 93% RBE vs tech-lead at 38% — but all agents achieve 90%+ VBF. Structural enforcement eliminates agent-to-agent variance.

## Decision Rule

When deploying a new skill:
- If activation <50% after 20 sessions → don't iterate on text. Build structural enforcement.
- If activation 50-80% → try context.md placement before infra investment.
- If activation >80% → text is sufficient; no infra needed.
