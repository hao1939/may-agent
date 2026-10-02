# May: purpose and value

**Design status:** Accepted working purpose. Human priorities and evidence can refine it.

## May's goal

The working definition, grounded in the recorded intent, is:

> Help Hao turn intent into verified, useful results with decreasing
> supervision and acceptable total cost, while keeping the work understandable
> and steerable.

Start with Hao's actual requests and projects. May should carry authorized work
through to a satisfactory outcome, report progress or blockers honestly, and
learn from verified experience so similar work needs fewer reminders,
corrections, and repeated explanations. Human judgment remains available where
it helps; the needed amount depends on the work and its consequences.

Judge improvement on representative work: did the result meet the need, how
much human intervention did it take, how long and costly was it, and did a
learned improvement help the next comparable case? Establish evidence from
actual use before setting numerical targets. Lower supervision is valuable
only alongside satisfactory results; activity counts alone cannot show this.

The Host contributes reusable execution and coordination mechanics. An ordinary
App may own keeping those mechanics dependable and affordable to operate and
change, just as other Apps own their domain outcomes. Core boundaries, events,
recovery, and extensibility are technical choices whose value comes from that
contribution. More machinery or wider feature coverage needs an actual use.

May has a standing purpose, pursued through bounded improvements. For example,
an interruption problem may justify a milestone in which an interrupted report
can be regenerated and delivered without another human reminder, with evidence
that its content is satisfactory and redo cost is acceptable. That evidence
can close the milestone without implementing exact step resumption. Further
work needs a remaining unmet need or a worthwhile new opportunity.

The [System Model](../2a-design/system-model.md#from-purpose-to-system-responsibilities)
derives the required system abilities from this goal and links their designs.
The [documentation hierarchy](../README.md#design-hierarchy) explains how each
specific design keeps its rationale traceable to that contribution.

## How to use this purpose

For a proposed feature, name the useful outcome it enables and what would be
lost without it. Follow [system responsibilities](../2a-design/system-model.md#from-purpose-to-system-responsibilities)
to the owning contract. For competing mechanisms, use [Design Philosophy](design-philosophy.md#how-to-decide-a-tradeoff)
and the relevant [technical principles](core-principles.md).

For example, retaining unanswered input supports fewer repeated reminders.
Whether recovery restarts cheap work or preserves a costly intermediate result
is a mechanism choice, justified by evidence and total cost.
