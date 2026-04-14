# DD#710: Pass Rate Illusion — Design Constraint Compliance in LLM Issue Resolution

**Source**: "Does Pass Rate Tell the Whole Story? Evaluating Design Constraint Compliance in LLM-based Issue Resolution" (arXiv:2604.05955)  
**Authors**: Yu et al. (11 authors, Fudan University)  
**Date**: April 7, 2026  
**Signal**: ★★★★★ — Directly explains gym-production gap mechanism  
**Tags**: benchmark-validity, evaluation-gap, design-constraints, SWE-bench  
**Cluster**: Gym-Production Transfer Gap

## Core Finding

**Test pass rates substantially overestimate patch quality.** Fewer than half of test-passing patches are fully design-satisfying. Functional correctness exhibits **negligible statistical association** with design satisfaction.

This is the quantitative smoking gun for what we've observed empirically: agents can "pass" gym benchmarks while missing the constraints that matter in production.

## Key Data Points

- **495 issues, 1,787 validated design constraints** across 6 repositories
- Constraints mined from real-world pull request code reviews — the implicit knowledge never encoded in tests
- Types: architectural conventions, error-handling policies, maintainability requirements
- **< 50% of resolved issues** are fully design-satisfying even among passing patches
- **Negligible statistical association** between test pass ↔ design satisfaction
- Providing design guidance reduces violations but substantial non-compliance remains

## Why This Matters for Us

### Direct Explanation of EXP-100/107 Ceiling Effect

Our gym scenarios have a binary pass/fail criterion (tests pass, output correct). In production, the coder agent must also satisfy:
- **Convention compliance**: project coding conventions, file structure patterns
- **Architecture constraints**: where to put code, how to organize imports, error handling
- **Maintainability**: code review-worthy patches vs "it works but..."
- **Context sensitivity**: understanding the broader codebase intent

The gym strips all of this away. A gym task that tests "modify file X to fix bug Y" ignores the 1,787 implicit constraints that a PR reviewer would enforce. **The gym isn't too easy — it's measuring the wrong thing.**

### Explains FM-3.3 Production Rate Discrepancy

Production FM-3.3 rate: 50-70% (KE-106)  
Gym FM-3.3 rate: 4.8% (EXP-107 combined)

The gap isn't complexity — it's **constraint density**. Production tasks have high implicit constraint density (conventions, architecture, review expectations). Gym tasks have near-zero constraint density (just: does the test pass?). FM-3.3 (verification confabulation) is triggered by constraint density, not task difficulty.

## Design Implications

1. **Add constraint layers to gym scenarios**: Don't just test "does it work" — add architectural constraints, convention requirements, implicit design rules
2. **Mine production constraints**: Extract the implicit constraints from real production PR reviews and inject them into gym scenarios
3. **Multi-criteria evaluation**: Replace binary pass/fail with multi-dimensional scoring (functional correctness, design compliance, convention adherence, verification completeness)

## Connection to Other Papers

- **SWE-Skills-Bench (2603.15401)**: Skills injection doesn't help because the benchmark doesn't capture what production demands
- **Agent-CoEvo (2604.04580)**: Tests themselves are misaligned — need coevolution of code and behavioral constraints
- **KE-101 Law 2**: Structural interventions > content interventions — design constraints ARE structural
- **DD#708 (Beyond Resolution Rates)**: Behavior predicts success, not instruction compliance — design constraint compliance IS behavior

## Actionable for Bob/Coach

The gym-production gap is not about making tasks harder. It's about making evaluation **richer**. The path forward:
1. Add design constraint checking to gym evaluation (mine from production PR patterns)
2. Score verification completeness against constraint density, not binary pass/fail
3. Use LLM-based constraint verification (as this paper does) to automate design-aware evaluation
