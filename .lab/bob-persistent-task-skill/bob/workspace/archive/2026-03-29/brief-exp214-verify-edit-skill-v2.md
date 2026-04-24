# EXP-214: Verify-After-Edit Skill v2

## Context
EXP-213 tested verify-after-edit skill v1 on `convention-verify-edit`. Results: convention check pass rate doubled (30% → 60%), with one 5/5 run. But 60% is insufficient for promotion — need ≥80%.

## Hypothesis
Skill v1 was too permissive — it said "if there's a validation command, run it." The agent often did the read-back (C2.3) but skipped explicit JSON validation (C3). Skill v2 makes validation NON-OPTIONAL, adds a ❌ WRONG example showing read-back-only as a violation, and provides a quick-reference table. This should push convention compliance from 60% → ≥80%.

## Key Changes (v1 → v2)
1. **"Two-Step Rule" framing** — validation is presented as equally mandatory to read-back, not optional
2. **Explicit ❌ WRONG example** — shows that read-back without validation IS a convention violation
3. **Quick-reference table** — file-type → validation command mapping for instant lookup
4. **"Read-back alone is NOT sufficient" warning** — directly counters the model's "looks good, moving on" bias

## Lab Fork
`agents/.lab/verify-edit-skill-v2/skills/verify-after-edit.md`

## Experiment Design
- **Scenario**: `convention-verify-edit`
- **Agent**: coder
- **Control**: 5 runs WITHOUT the skill (already done in EXP-213 — reuse control data: 3.6/5 avg, 3/10 convention)
- **Treatment**: 5 runs WITH `verify-edit-skill-v2` fork
- **Success Criteria**: Convention pass rate ≥80% (8/10 convention checks), avg score ≥4.4/5

## How to Run
```bash
# Treatment (5 runs with v2 skill)
node test/gym/gym-runner.ts --scenario convention-verify-edit --agent coder --fork verify-edit-skill-v2 --runs 5
```

## Decision Matrix
- **≥80% convention**: Promote v2 skill to coder's skills/. This is the verification coaching target — success here is high-value.
- **60-79% convention**: Marginal improvement. Consider accepting 60% and promoting v1, or explore fundamentally different approach (runtime nudge).
- **≤60% convention**: Rule of Two triggered. Stronger wording didn't help. Accept as prompting ceiling and investigate runtime solutions.
