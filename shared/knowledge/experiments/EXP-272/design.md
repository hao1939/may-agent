# EXP-272: Skill Specificity via KE Binding (H-186 Test)

**Date**: 2028-08-05
**Status**: DESIGNED
**Predecessor**: EXP-277 (capability-axis taxonomy provides tagging framework)
**Hypothesis**: H-186 (Discovery Skill Specificity Gradient)
**Grounding**: arXiv:2604.26805 (Bian Que — skills as context-filters reduce dilution; 75% alert reduction in production)

---

## Research Question

Do skills that explicitly bind to specific knowledge entries produce higher gym pass rates than generic skills?

## Hypothesis

- **H-272a**: Skills augmented with explicit KE references improve gym pass rate by ≥15pp over generic skills on the same scenarios.
- **H-272-null**: KE binding adds noise/length without improving pass rate (Δ < 5pp).

## Rationale (from Bian Que)

Bian Que's "flexible skill arrangement" binds each skill to (1) what data to retrieve and (2) what knowledge applies. This prevents the "dilution problem" — irrelevant context causing hallucination. Our current skills specify behavior but NOT which KEs are relevant. Adding explicit KE references should act as a context filter.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (control) | Current skill file as-is | 10 runs × 3 scenarios = 30 | Standard agent with existing skills |
| B (treatment) | Skill file augmented with "📚 Relevant KEs: KE-xxx, KE-yyy" section listing 2-4 most relevant entries | 10 × 3 = 30 | Same scenarios, same agent |

### Scenarios

Select 3 gym scenarios where skill knowledge matters:
1. A verification-heavy scenario (V-axis from EXP-277)
2. A context-selection scenario (C-axis)
3. A tool-choice scenario (T-axis)

### Skill Augmentation Template

```markdown
## 📚 Relevant Knowledge (read before acting)
- **KE-xxx**: <one-line summary> — applies when <condition>
- **KE-yyy**: <one-line summary> — applies when <condition>
```

### Metrics

- **Primary**: Gym pass rate (binary per scenario)
- **Secondary**: 
  - Token usage (does KE binding increase or decrease total tokens?)
  - Evidence of KE citation in agent output (did agent actually use the referenced KEs?)

### Decision Rule

- **Confirmed** if: Arm B pass rate ≥ Arm A + 15pp (Fisher exact p < 0.05)
- **Falsified** if: Arm B pass rate < Arm A + 5pp
- **Inconclusive** if: 5pp ≤ Δ < 15pp → increase N

## Execution Plan

1. Select 3 scenarios from gym catalog
2. Identify which skills are relevant to each scenario
3. For each skill, find 2-4 KEs that are most relevant (grep KB for related topics)
4. Create augmented skill variants in a branch
5. Run gym batch: control then treatment

```bash
export GYM_AGENT_BIN=/usr/local/bin/may-agent
# Control
scripts/gym-run.sh <scenario> --agent bob --tag EXP-272-control --timeout 600
# Treatment (with augmented skills)
scripts/gym-run.sh <scenario> --agent bob --tag EXP-272-treatment --timeout 600
```

## Risk / Pre-mortem

If falsified: likely because (a) agents already find relevant KEs via context.md without explicit binding, or (b) the binding adds length without agents actually reading it. In that case, the dilution problem may not exist in our system (unlike Bian Que's larger-scale ops environment).
