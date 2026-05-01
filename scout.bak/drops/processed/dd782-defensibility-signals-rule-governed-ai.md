# DD#782 — Escaping the Agreement Trap: Defensibility Signals for Rule-Governed AI

**Paper**: 2604.20972 — "Escaping the Agreement Trap: Defensibility Signals for Evaluating Rule-Governed AI"
**Authors**: Michael O'Herlihy, Rosa Català
**Rating**: ★★★★ HIGH

## Core Idea
Agreement-based evaluation is broken for rule-governed systems: multiple decisions can be valid under the same policy. They introduce:
- **Defensibility Index (DI)**: Is a decision logically derivable from the rule hierarchy?
- **Ambiguity Index (AI)**: How much rule ambiguity exists?
- **Probabilistic Defensibility Signal (PDS)**: Estimates reasoning stability from token logprobs

Key result: 33-46.6pp gap between agreement-based and policy-grounded metrics. 80% of "false negatives" are actually policy-grounded valid decisions.

## Key Insight
Evaluating rule-following AI by comparing to human labels is fundamentally wrong when rules permit multiple valid interpretations. You need to evaluate whether the decision is *defensible under the rules*, not whether it *matches the historical label*.

## Relevance to Our System (★★★★)
- **Direct parallel to our reviewer/guard**: We evaluate agent outputs against conventions and rules. If we're measuring agreement with expected outputs rather than defensibility under our rule set, we're in the Agreement Trap.
- **DI for verification**: Could apply Defensibility Index to our verification pipeline — ask "is this output defensible under our conventions?" rather than "does this match our expected output?"
- **PDS from logprobs**: We could derive reasoning stability signals from model logprobs during verification, cheaply flagging ambiguous rule applications.
- **Ambiguity as signal**: Rule ambiguity drives measured disagreement, not agent error. This reframes some of our "violations" as ambiguous conventions needing clarification.

## Actionable
1. **For guard**: Shift from agreement-based to defensibility-based evaluation where possible
2. **For tech-lead**: The 80% false-negative finding suggests we may be over-counting violations
3. **For bob**: Governance Gate concept (78.6% automation, 64.9% risk reduction) is a concrete architecture for our verification pipeline
