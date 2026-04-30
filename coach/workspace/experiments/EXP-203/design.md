# EXP-203 Design: Symptom-Based Relational Bug Recognition Skill

**Date**: 2026-06-22
**Status**: RUNNING (lab fork created 2026-06-23, awaiting gym runs)
**Predecessor**: EXP-168 (symptoms arm = 75% vs 0% baseline)
**Agent**: coder

## Research Question

Can a **symptom-description skill** (permanently deployed, not scenario-specific) lift coder's pass rate on relational bug scenarios from 0% to ≥30%?

## Hypothesis

- **H-203a**: Symptom-based skill achieves ≥30% on cascading-fix-trap-v2 (N=10)
- **H-203-null**: No improvement — symptom descriptions only work when injected at task level, not as background skills

## Rationale

EXP-168 showed symptoms (75%) >> causal analysis (38%) >> vague (0%). But EXP-168 injected hints directly into the task prompt. The question is whether a **background skill** (always present) can trigger the same recognition during a novel bug encounter.

## Design

### Skill Content (draft)

```markdown
# Relational Bug Recognition

## Symptoms to Watch For
- All unit tests pass but integration/E2E tests fail
- Fixing one bug makes another appear or changes behavior elsewhere  
- The "obvious" fix works locally but breaks something downstream
- Test output shows correct individual values but wrong final result
- Multiple components touch the same data/state

## When You See These Symptoms
1. STOP fixing the obvious value-level bug
2. Map the data flow: which components run in what order?
3. Check: is the ordering/flow correct, or just the values?
4. The real bug may be component ordering, shared state, or data flow — not the values themselves
```

### Arms

| Arm | Agent Fork | N | 
|-----|-----------|---|
| A | coder (baseline) | 10 | Reuse: 0/140 baseline |
| B | coder + symptom skill | 10 | New fork with skill |

### Scenarios
- Primary: cascading-fix-trap-v2
- Transfer: competing-fix-strategies (also 0% — tests generalization)

### Success Criteria
- ≥3/10 pass on cascading-fix-trap-v2 → PROMOTE skill
- ≥1/10 on competing-fix-strategies → evidence of transfer
- 0/10 on both → REJECT (background skills can't trigger recognition)

## Execution Plan
1. Create lab fork: `agents/.lab/coder-symptom-recognition/`
2. Add skill to fork's skills directory
3. Run gym: `scripts/gym-batch.sh --scenarios cascading-fix-trap-v2,competing-fix-strategies --agent coder-symptom-recognition --trials 10`
4. Analyze results, write up
