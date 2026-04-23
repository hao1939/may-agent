# EXP-208: Diagnosis-Before-Action Skill Verification

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: EXP-164 (100% pass with information provision, 0% baseline)
**Hypothesis**: H-161 (root-cause misidentification)

---

## Research Question

Does the deployed `diagnosis-before-action` skill (context.md text + skill file) improve coder's pass rate on misleading-test-fix compared to pre-deployment baseline (1.5%, 1/65)?

## Background

EXP-164 showed that providing a pre-written DIAGNOSIS.md (F1, information provision) yielded 100% pass. The insight was translated into a skill file (`agents/coder/skills/diagnosis-before-action.md`) and context.md rules deployed 2026-06-25. However, **no gym verification has been run since deployment**. The last runs (April 17) predate deployment and show 1/17 (~6%). This experiment verifies whether the skill text alone (without the literal DIAGNOSIS.md artifact) transfers the benefit.

## Hypothesis

- **H-208a**: The skill raises misleading-test-fix pass rate to ≥50% (from 1.5% baseline), because the skill text cues the agent to verify test expectations before editing.
- **H-208-null**: Pass rate remains ≤15% — the skill text is too abstract; only concrete artifacts (pre-written diagnosis) change behavior.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Current coder (with deployed skill) | 10 | Post-deployment verification |

No control arm needed — baseline is well-established at 1/65 (1.5%) from 65 pre-deployment runs.

### Scenario

- `misleading-test-fix` (standard, agent=coder)

### Metrics

- Primary: pass rate (all criteria)
- Secondary: whether agent reads test assertions before editing production code

### Decision Rule

- **Skill working** if: ≥5/10 pass (p<0.001 vs 1.5% baseline by Fisher's exact)
- **Skill partially working** if: 2-4/10 pass (significant improvement but not at EXP-164 levels)
- **Skill NOT working** if: 0-1/10 pass — skill text doesn't transfer the information provision benefit
- If NOT working → design EXP-209 to embed diagnosis prompt directly into coder's workflow (not just skill text)

## Execution

```bash
scripts/gym-run.sh misleading-test-fix --agent coder --tag EXP-208 --trials 10 --timeout 600
```

## Cost

~$0.50-1.50 (10 runs × $0.05-0.15 each)
