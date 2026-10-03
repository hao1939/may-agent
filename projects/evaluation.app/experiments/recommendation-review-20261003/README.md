# Recommendations for May: first trial

Evaluation should propose the smallest evidence-backed correction or
investigation in its existing report. May decides whether to pursue it or names
missing evidence. This needs no new schema or repair workflow. Accepting a
proposal neither proves delivery nor replaces human approval for applying an
automatically prepared improvement.

## What was compared

The existing [judgment harness](../systemic-pattern-review-20260927/judgment-trial.ts)
ran the configured `evaluator-deepseek` (`deepseek-v4-flash`) with finish-only
tools and no model fallback. Two frozen cases derived from observed Task history
used identical evidence across baseline criteria, recommendation guidance, and
a refinement requiring supported scope and preservation of unfinished work.
A third synthetic valid-wait case ran only on the refined candidate.

| Case | Observation | Recommendation review |
| --- | --- | --- |
| Repeated no-op results retaining runnable requests | All versions detected the loop. Candidate recommendations became more concrete, but still suggested stopping retries without proving how unfinished work would resume. | The finding supports investigation. The proposed scheduling change is not justified. Silence with pending work is insufficient verification. |
| Recorded settlement followed by quiet execution | Baseline and refined criteria recognized recovery; the first candidate recommended new acceptance restrictions. | The refined proposal was more restrained. Matching settlement counts still do not prove each request was fulfilled. |
| Implementation delivered, independent review legitimately pending | Refined criteria recommended no repair and preserved the review dependency. | Correct contrast judgment; no baseline comparison for this case. |

## Conclusion and limits

The responsibility split is useful, but this small trial does **not** establish
reliable improvement in recommendation quality. Keep the guidance and May's
judgment; do not automatically execute a report's suggested repair. A code
proposal must identify the broken contract or justify changing it. Verification
must show both reduced waste and preservation of remaining obligations.

There was one generation per case per version, no blinded scoring, and no
statistical comparison. Request contents were deliberately outside the supplied
review evidence; some outputs misidentified the recovery Task as its linked
Conversation. The short quiet observation does not prove recurrence prevention.
The local harness changed only its review timestamp; evidence and criteria
hashes are in the receipts. No live selection, publication, owner handoff, or
application was exercised by this comparison. Gateway pricing is unknown, so
zero estimated cost in a receipt does not establish free inference.

Local prompts, cases, full judgments, sessions, usage, hashes and independent
assessment are retained at
`/app/.state/self-recovery-followthrough-20261003/REPORT.md`. This is an
installation evidence reference, not a portable test dependency. The existing
Task-outcome and metric-review suites passed (34 tests, 208 assertions); these
checks establish workflow compatibility, not recommendation quality.

Next observation should come from an ordinary review and May's explicit
accept/decline/missing-evidence decision, followed by independently verified
repair if warranted. Do not keep tuning against this tiny fixture set.
