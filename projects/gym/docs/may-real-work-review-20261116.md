# May real-work selection review — 2026-11-16

Status: bounded review complete; leave May unchanged. No new benchmark or model
run. This is an operator assessment, not an Alex adoption decision.

The north star remains **correct useful delivery, fewer operator corrections,
and acceptable total time/cost**. After the synthetic execution pilot, the
selection question was whether one recent real May request supported a concrete
behavior change. The selected request contains actual review corrections and
delivery evidence; the record also contains its eventual recovery and creator
acceptance. It does not justify treating the historical defect as unresolved.

## Selected request and observed recovery

May Task `goal/appdep_f589cb34b26748c1d9956641` handled PR
[#445](https://github.com/hao1939/may-agent/pull/445). The original assignment
was to correct ordinary Task-agent finish preflight, prove same-executor recovery
and no duplicate effects, and obtain independent review before publication.
Later creator revisions explicitly extended it through protected integration,
separate activation proof and a bounded runtime observation. This review concerns
May's handling of that request; it commissions no Host implementation.

| Evidence point | Observation | Implication for May evaluation |
| --- | --- | --- |
| Initial owner session `s_1794269122108_afd47ec5-eb1d-43d4-9425-274af44eae4a`; independent review `s_1794269458056_51c9cc63-1166-4282-9eca-0d78b7796e73` | Review found action-replay and request-Condition parity defects. May retained the work and reported it incomplete. | Real correction work occurred; tests passing did not establish delivery. |
| Publication session `s_1794271397713_c1df1988-1e0f-4e53-b21f-83997d2c2047`; fresh review `s_1794271441321_d23d0511-1299-4fdd-b1b1-33cc2d0a0040` | A later candidate received a clean independent review and was published. | Earlier findings cannot be counted as ignored without checking subsequent work. |
| Feedback session `s_1794272406626_5a62c947-3004-45f5-b3b9-d025461e8e64` | A new PR review identified a stale live-event defect despite earlier checks. May confirmed it, made a local correction and reported the remaining regression/review/publication work. | Initial implementation/review missed a defect. The response distinguishes partial repair from completed delivery. |
| Merge session `s_1794330016487_37d9d0b2-da4e-4355-9632-74d6d5205dd9` | PR merged as `d2cee42157e2ea5cfa4471b7de3d433c8b13bce5`; retained live provenance was still older. May kept an activation wait. | Source integration was not presented as runtime activation. |
| Reconciliation session `s_1794333853460_0e0fa2a0-8bb8-4061-8803-1b376da5b5e4` | May verified the authorized rollout receipt and source ancestry, checked the controlled observation and submitted convergence with retirement of the obsolete activation wait. | May consumed new evidence without repeating deployment or implementation. An executor result alone does not establish creator acceptance. |
| Retained creator snapshot `.state/workload-live-review-20261111/alex-input_appdep_c7460233bd58b188e5685d31.json` | Alex recorded convergence, accepted May attempt `r_3_a77b064f-7444-4504-99c8-0b0439dc44e2`, and recorded `may-task-closed:true`. | The retained caller record supplies the delivery/acceptance evidence missing from a worker claim alone. This is a historical fact, not a current live read. |

The rollout receipt's SHA256 is
`8018127bca72a32b395a07692d058563c6441a46a417eae2989045b10d89f158`.
Its source `88bd9c2c400667e2edf49c1c423bc9de9a604c5b` contains the merge.
The controlled observation is Alex session
`s_1794333797511_dd86e5d7-b03e-4b0e-8f7d-a78be2280b48`: the first finish
received actionable rejection, the next canonical read preserved resourceVersion
34 and both Conditions, and the same session then submitted its corrected result.
The creator snapshot subsequently records same-attempt correction and acceptance.
That demonstrates the repaired Host path; it is not a new Gym score for May.

## Attribution and limits

This was a corrected software defect with several review rounds. Those rounds
are potential efficiency evidence, but they are not automatically human/operator
corrections or a recurring May instruction defect. Reviewer sessions also share
the owner's Task binding; counting session files as independent owner failures
would misstate the record. The original implementation was imperfect and the
eventual recovery was evidenced. Both facts must remain visible.

The older ENOSPC request `may/request/appdep_d9622f89550e45c5017a81c0` was
excluded as a May behavior target: its retained failures happened during workspace
preparation before an agent session. Its November 11 stranded snapshot is not a
current May failure. A November 16 noon hygiene receipt has zero May attention
Tasks, but this alone does not prove that old request's terminal disposition.

This is a deliberately selected historical request, not a representative sample
or a fresh evaluation. Current May instructions, model and environment differ
from some historical runs. Human correction count, full delivery-cycle cost,
operator effort and attributable avoidable delay remain **unknown**, not zero.
The review does not establish May's general reliability, a production success
rate or an agent-quality improvement. Existing benchmark truth remains draft.

## Disposition and next trigger

Leave May's `agent.json` and `AGENTS.md` unchanged. Keep all three existing whole
benchmark assignments and their current diagnostic evidence. No new benchmark,
baseline selection, prompt tuning, evaluation, deployment or live Task action
follows from this review. The [structured review](agent-reports/may-real-work-review-20261116.json)
pins the inspected receipts and exact source identities; the
[May report](agent-reports/may.md) shows the updated plan separately from scores.

Alex remains the named plan owner; this operator review has not dispatched Alex
or created an owner decision. The next selection trigger is a concrete new May
delivery problem or an explicitly chosen efficiency investigation. Use the exact
request/generation, accepted outcome, correction or missing proof, subsequent
disposition, and available time/cost receipts. First distinguish agent behavior
from pre-agent infrastructure, source defects and valid authority waits. Then
define one bounded reproduction and acceptance check before proposing a change.
If the problem is already recovered or attribution remains unsupported, retain
the observation and stop without tuning. Reuse whole benchmarks where they test
the proposed change; changed definitions require fresh baselines and all runs
remain subject to the existing manual cycle ceiling.
