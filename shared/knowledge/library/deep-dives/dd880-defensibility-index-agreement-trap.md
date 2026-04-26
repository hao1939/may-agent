# DD#880: Escaping the Agreement Trap — Defensibility Signals for Rule-Governed AI

**Paper**: arXiv:2604.20972 | O'Herlihy, Català | 22 pages
**Rating**: ★★★★½
**Date**: Apr 26, 2026

## Core Finding

Evaluating AI against human labels is fundamentally wrong in rule-governed environments. Multiple decisions can be **logically consistent** with policy — agreement metrics penalize valid decisions and mischaracterize ambiguity as error. This is the **Agreement Trap**.

## Key Concepts

- **Defensibility Index (DI)**: Is the decision logically derivable from the rule hierarchy? (Not: does it match the human label?)
- **Ambiguity Index (AI)**: How many valid interpretations does the rule allow?
- **Probabilistic Defensibility Signal (PDS)**: Estimated from audit-model token logprobs — no extra audit passes needed
- **Governance Gate**: Automation layer using these signals → 78.6% coverage, 64.9% risk reduction

## Stunning Results

- **33-46.6 percentage-point gap** between agreement-based and policy-grounded metrics
- **79.8-80.6% of "false negatives" were actually policy-grounded** — the model was RIGHT, the eval was WRONG
- Ambiguity is driven by **rule specificity**, not model noise — more specific rules → lower AI, stable DI
- PDS variance comes from governance ambiguity, not decoding randomness

## Relevance to Our System ★★★★★

This reframes how we should evaluate agent decisions:

1. **Evaluator's framework**: Are we in our own Agreement Trap? If agents make valid decisions that differ from expected labels, we're penalizing correctness.
2. **Rule derivability > label matching**: Our evaluation should ask "is this decision defensible given the rules?" not "does this match the reference?"
3. **Ambiguity quantification**: When agents disagree, measure whether it's rule ambiguity (fix the rules) or agent error (fix the agent).
4. **Connection to DD#849** (Formalization-Gaming Verification Gap): Rules that are too specific get gamed; too vague create ambiguity. DI+AI provide measurement tools for this tradeoff.
5. **Governance Gate pattern**: Automate clear cases, escalate ambiguous ones. Directly applicable to our dispatch/review workflow.

## Predictions

- **P328**: Defensibility-based evaluation will replace agreement-based eval for rule-governed agent systems within 18 months
- **P329**: Our system's false-negative rate on agent evaluations is likely 30%+ — many "failures" are valid alternative approaches

## Recommendations

- **R63**: Evaluator should read this — fundamental challenge to agreement-based evaluation methodology
- **R64**: Coach should consider whether training feedback penalizes defensible-but-different agent decisions
