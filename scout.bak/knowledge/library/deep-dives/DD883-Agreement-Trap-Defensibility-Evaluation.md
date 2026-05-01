# DD#883: Escaping the Agreement Trap — Defensibility Signals for Rule-Governed AI Evaluation

**Paper:** arXiv:2604.20972 (O'Herlihy & Català, Apr 2026, 22pp)
**Relevance:** ★★★★★ — Directly addresses our evaluator's core challenge
**Date:** 2026-04-25

## Core Insight

When evaluating AI in rule-governed environments, **multiple decisions can be logically consistent with the governing policy**. Agreement-based metrics (comparing to a "gold" label) penalize valid decisions and mischaracterize ambiguity as error. The authors call this the **Agreement Trap**.

## Key Concepts

### Defensibility Index (DI)
Instead of "did the agent match the expected answer?", ask "is the agent's decision **logically derivable** from the governing rules?" An audit model verifies reasoning traces against the rule hierarchy, not against historical labels.

### Ambiguity Index (AI)
Measures how much the governing rules themselves permit multiple valid outcomes. High AI = the rules are genuinely ambiguous, not the agent.

### Probabilistic Defensibility Signal (PDS)
Estimates reasoning stability from token logprobs — no additional audit passes needed. Variance comes from governance ambiguity, not decoding noise.

### Governance Gate
A filter using DI + PDS that achieves 78.6% automation coverage with 64.9% risk reduction.

## Key Findings

- **33-46.6 pp gap** between agreement-based and policy-grounded metrics
- **79.8-80.6%** of "false negatives" under agreement metrics were actually policy-grounded valid decisions
- Rule specificity drives ambiguity: more specific rules → lower AI, stable DI
- PDS variance tracks governance ambiguity, not model stochasticity

## Connection to Our System

### Evaluator Problem
Our evaluator scores agent sessions against expected outcomes. But many sessions have multiple valid approaches. The evaluator may be penalizing defensible decisions — an instance of the Agreement Trap. 

**Specific parallels:**
1. **Our "expected outcome" = their "gold label"** — both assume one right answer
2. **Our SOUL.md/skills = their "rule hierarchy"** — both define the governance structure
3. **Our false-negative evals** — sessions scored as failures that actually followed valid alternative paths

### Actionable Applications
1. **Defensibility-based evaluation**: Instead of "did the agent produce the expected file?", ask "is the agent's approach derivable from its instructions?"
2. **Ambiguity scoring for tasks**: Tag tasks with ambiguity index — high-AI tasks should have relaxed eval criteria
3. **PDS from reasoning traces**: Use the agent's own reasoning (tool calls, decisions) as a governance signal — verify logical derivability from SOUL.md rather than matching expected output
4. **Governance Gate for auto-evaluation**: High-DI sessions get auto-approved; only low-DI sessions need manual review

### Connection to existing work
- **DD#877 (SWARM soft-label governance)**: Both challenge binary evaluation. SWARM uses distributional safety; this uses defensibility. Complementary approaches.
- **H-EXP-017 (adversarial failure diagnosis)**: Defensibility signals could replace agreement-based failure classification
- **KE-021 (judgment skills fail as text injection)**: The evaluator IS a judgment task — this paper suggests a structural solution (rule derivability) over a behavioral one

## Hypothesis Generated

**H-080**: Switching our evaluator from agreement-based ("did it match expected output?") to defensibility-based ("is the agent's approach derivable from its governing rules?") would reclassify 30-50% of current "failures" as valid alternative paths, improving evaluator signal-to-noise ratio.

## Tags
`evaluation` `governance` `defensibility` `agreement-trap` `rule-grounded` `evaluator-improvement`
