# Evaluation within Alex

**Supports:** [Improve from evidence](../2a-design/practice-learning-loop.md).
Review work and recurring problems so Alex can preserve good practice and
choose useful corrections. **Choice basis:** [Agents judge; infra executes](../1-principles/core-principles.md).
An assessment supplies evidence; it does not own the subject's completion.

Evaluation now runs through Alex's ordinary Task admission. An explicit
`review-task-outcome` names the subject App and Task; `review-metric` names
the metric and evidence cutoff. The App selects `evaluator` or
`evaluator-deepseek`. Automatic selection retains its explicit rollout flag
and bounded allowance. Metric samples update evidence; meaningful transitions
and selected review boundaries can request judgment.

The evaluator reads canonical Task evidence, publishes an immutable assessment
and returns through the existing relationship. Alex receives reports as ordinary
work and judges whether to reuse an investigation, commission a correction or
retain no change. May independently observes Alex's operation and retains the
human escalation boundary. These are the same Task and metric contracts used
elsewhere; no separate Evaluation App remains.

The [criteria](../../criteria/criteria.md) and
[scoring guidance](../../criteria/scoring.md) remain current reviewer knowledge.
Calibration and earlier lessons live beside them. The design and trial records
in this directory preserve the reasoning behind review selection, publication
and evidence limits. References in dated records to the old Evaluation App
describe the previous organization, not a callable address.

Existing durable reports remain in the configured report store, normally
`.state/evaluation/reports`. Removing the App source neither deletes these
reports nor changes their immutable identity. See
[retirement and preservation](../../archive/retired-apps/README.md) for older
App-local records and source.
