# H-196: Defensibility-Based Evaluation Reduces False Negatives by 30-50%

**Created**: 2026-04-25 by Bob
**Status**: proposed
**Confidence**: P(H) = 0.55
**Source**: DD#883 (arXiv:2604.20972 — "Escaping the Agreement Trap")
**Connects**: H-178 (evaluator anonymization), H-EXP-017 (adversarial failure diagnosis), KE-021

---

## Claim

Switching our evaluator from agreement-based scoring ("did it match expected output?") to defensibility-based scoring ("is the agent's approach derivable from its governing rules — SOUL.md, skills, task description?") would reclassify 30-50% of current "failures" as valid alternative paths, improving evaluator signal-to-noise ratio.

## Mechanism

DD#883 shows a 33-46.6pp gap between agreement-based and policy-grounded metrics across rule-governed evaluation. 79.8-80.6% of "false negatives" were actually policy-grounded valid decisions. Our evaluator has the same structure: it compares agent output to expected outcomes (agreement), but the SOUL.md + skills define a rule hierarchy that permits multiple valid approaches. When the agent takes a valid-but-unexpected path, it gets scored as failure.

## Evidence

### Supporting
- DD#883: 33-46.6pp agreement vs defensibility gap in rule-governed evaluation
- DD#877 (SWARM): Binary compliance checks lose signal — distributional/soft-label approaches outperform
- H-EXP-022 (false negative audit): Found evaluator false negatives where agents made defensible decisions
- Our gym baseline: 10/20 (50%) — some failures may be false negatives from agreement scoring

### Against / missing
- Our tasks may have less ambiguity than DD#883's rule-governed domains
- Defensibility checking requires an audit model pass — adds cost
- May relax evaluation too much, letting actual failures through as "defensible"

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Audit 20 recent "failed" evaluations for defensibility | ≥6 (30%) are defensible alternative paths |
| Implement defensibility gate on evaluator | False negative rate drops by ≥25% |
| High-ambiguity tasks (multiple valid approaches) | Defensibility gap is larger (>40%) |
| Low-ambiguity tasks (one clear path) | Defensibility gap is small (<15%) |

## Test Plan

- **Phase 1 (cheap)**: Manually audit 20 recent evaluator "failures" — for each, check whether the agent's approach is derivable from SOUL.md + skills + task description. Score as {defensible, partially-defensible, indefensible}. If ≥6/20 are defensible → proceed to Phase 2.
- **Phase 2**: Implement a lightweight defensibility check: present the audit model with (1) the governing rules, (2) the agent's reasoning trace, (3) ask "is this decision derivable from the rules?" — compare to agreement score.
- **Decision rule**: Confirmed if ≥30% of failures are reclassified. Falsified if <15%.

## Implications if true

- Evaluator pipeline needs a defensibility layer before final scoring
- Tasks should be tagged with an Ambiguity Index (high-AI = relaxed eval)
- H-178 (evaluator anonymization) becomes less urgent — defensibility addresses the root cause
- Gym scenario scoring could also benefit from defensibility checks

## Links

- Parent: DD#883 (arXiv:2604.20972)
- Related: H-178, H-EXP-017, DD#877
- Tracked in: agents/bob/workspace/todo.md
