# Design Philosophy

**Design status:** Accepted direction; source-backed synthesis for ongoing review.

The project's goal gives work its value. Simplicity, robustness, autonomy,
modularity, and learning help us reach that goal; each must justify its
contribution.

This page explains what we value and how to decide tradeoffs.
[Core Principles](core-principles.md) applies that reasoning to architecture. The
[history and source notes](../archive/reviews/design-philosophy-history-20260909.md)
preserve the supporting conversations, qualifications, and superseded ideas.
New human guidance can refine this understanding; inferred preferences are
not additional permission gates.

## Define the goal first

A goal must be clear enough to distinguish useful progress from activity and
to decide what work we can leave out. Before choosing a design, establish:

- **Who benefits and what changes:** the real problem and the observable outcome.
- **What counts as enough:** the evidence that would show the need is met.
- **What bounds the work:** scope, essential constraints, acceptable cost, and
  limitations we can tolerate.
- **What we pursue next:** a bounded milestone and when to finish, wait, or
  reconsider. For exploration, this can be a question answered by evidence.

Keep this concise in the existing project context. A short statement with a
concrete example may suffice; no new schema or planning ceremony is needed.
If the goal is too vague to choose between alternatives, clarify it or run a
small investigation before committing to a larger implementation. Refine the
goal when human priorities or evidence change, and explain the change.

### May's goal

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

## Value and cost

**Value is what a choice contributes to the project goal:** better outcomes,
useful capability, avoided disruption, or resources freed for other work.
**Cost is what we spend or give up:** implementation and maintenance effort,
compute, delay, human attention, added failure risk, or useful capability lost.

These describe consequences of a choice. A feature or design property can
affect both sides. Simplicity often reduces future cost, but simplifying an
existing system may require refactoring or accepting narrower behavior.
Robustness protects useful outcomes, while the mechanisms providing it may
consume resources and create new failure paths.

| Choice and alternative | Value gained | Cost incurred or accepted |
| --- | --- | --- |
| Redo cheap work instead of precise resume | Less state and recovery logic to maintain; easier diagnosis | Extra computation and delay after interruption |
| Keep a coarse checkpoint instead of restarting from scratch | Less discarded work; earlier completion after interruption | Saving, restoring, and validating progress; ongoing maintenance |
| Add human review to a consequential action | Mistakes caught before they become costly | Human attention, waiting, and coordination |

Compare effects against the same alternative, workload, and useful lifetime.
A cost saving is a benefit: count it once, either as gained value or reduced
cost. A lower compute bill and faster delivery can be distinct benefits;
"lower compute bill" and "money saved on compute" describe the same benefit.
Explain material tradeoffs in their natural units; they need not share a
monetary score.

### Match the horizon and risk

Choose the comparison horizon from expected lifetime and usage. A small
recurring cost can dominate a frequently used foundation over time; a trial
may disappear before an optimization repays its initial investment.

| Situation | Give more weight to | Practical choice |
| --- | --- | --- |
| Durable, frequently used core or capability | Cumulative execution cost, failures, maintenance, and future changes | Invest in simple, dependable foundations where repeated benefit repays the initial effort |
| Trial with uncertain survival | Immediate usefulness, learning, time to evidence, and ease of removal | Run a small experiment; accept affordable inefficiency and defer hardening until continued use warrants it |

For costs expressed in comparable units, a rough estimate over that horizon is:

```text
upfront cost + expected uses × cost per use
  + upkeep, change, and removal cost + expected failure loss
```

Estimate benefits over the same horizon. Expected uses should reflect likely
lifespan and the chance of continued adoption. An experiment can deliver useful
knowledge even when its feature is discarded. Reassess costs and robustness
when a trial becomes regularly used. The labels "core" and "experiment" alone
do not establish actual usage or justify an investment.

Risk changes how much uncertainty we can accept. When being wrong has a small,
contained, reversible cost, favor potential value and quick learning. When a
mistake could cause substantial or lasting loss, give more weight to evidence,
containment, and protection before committing. Consider likelihood, impact,
who or what is affected, and the effort and time to undo the mistake. A trial
that changes important shared state may still have costly consequences.

Probability × consequence is a useful rough estimate of a failure scenario's
expected loss over the horizon. For recurring failures, use expected occurrence
count × loss per occurrence. Consider credible severe losses separately; an
attractive average does not make an unaffordable downside acceptable. Risk can
appear as added cost or reduced expected value; count the same consequence
once. Use ranges or a bounded trial when estimates are uncertain.

## How to decide a tradeoff

**What value does this provide, what does it cost, and is it worth that cost?**
Value means contribution to the [project's goal](#define-the-goal-first),
including evidence that helps us choose the next step. Ask this when adding,
keeping, fixing, or removing a feature, guarantee, or mechanism. Compare with
the simplest sufficient alternative, including doing nothing when the need
can wait. A useful feature can still cost more than its value justifies.

Choose the simplest sufficient solution at an acceptable total cost. Judge
features and design properties by their [effects on value and cost](#value-and-cost).
Complexity creates ongoing cost, even when it saves compute on an individual
run. Accept modest runtime cost or occasional rework to avoid permanent
machinery. Add a feature when its additional value or savings justify that
burden. Existing features and contracts must earn their continued cost too:
simplifying the guarantee
can be better than making its implementation more sophisticated.

The order below is a synthesis for review, grounded in the recorded philosophy
and subsequent corrections; it is not a numerical scorecard.

1. **Start with the project goal.** Identify the unmet need this change serves
   and what would count as enough. Compare options against that outcome,
   current scale, and expected use. A feature, architecture, metric, or flawless
   execution trace has value only through the outcome it helps produce. Remove
   unnecessary scope before optimizing its implementation.

2. **Question the contract as well as the implementation.** A guarantee is
   not essential merely because we documented, coded, or tested it. Identify
   what the real use case needs and what it can give up: exact resumption,
   immediate delivery, universal automation, compatibility, or rare-case
   coverage may cost more than they are worth. Adopt a weaker, clear contract
   when it still serves the real need. Update affected code, consumers, and
   documentation together, and account for existing data and ongoing work.
   Describe the resulting behavior honestly. Human authority and actual
   consequences matter more than preserving a self-imposed design guarantee.

3. **Match value and cost to expected lifetime and usage.** Use the
   [horizon and risk comparison](#match-the-horizon-and-risk): recurring costs
   matter greatly for a durable, frequently used foundation; immediate value
   and learning matter more for a trial with uncertain survival. Include
   building, understanding, operating, changing, and eventually removing it,
   as well as compute, latency, likely failures, redo, human attention, and
   the more valuable work displaced by this choice.
   Prefer the simpler option when both are sufficient and the added benefit
   is small or uncertain. A more complex option can win when it materially
   reduces that total cost or achieves an outcome the simpler one cannot.

4. **Make each added mechanism earn its place.** Ask what additional benefit
   this checkpoint, cache, event, layer, or automation buys over the existing
   path. Consider how often it helps and how consequential the case is. A
   cheap, common foundation may cover most needs while agents handle varied
   exceptions. A rare case can still justify code when its consequences are
   unacceptable. The 20/80 rule allocates implementation effort. Feature
   completeness and rare-case automation can be traded away explicitly when
   the remaining behavior is sufficient; a percentage alone settles neither.

5. **Match confidence to the cost of being wrong.** When mistakes are
   affordable and reversible, favor potential value and a quick experiment.
   As consequences and reversal cost rise, require stronger evidence and
   protection. Prefer a small trial that answers the decisive question while
   keeping losses tolerable. Use existing evidence or rough estimates when
   sufficient; do not build a measurement framework for every choice. Keep
   likely changes local, without hypothetical extension machinery. Revisit
   the choice when adoption, workload, failure cost, or requirements change;
   stop optimizing while the current result is enough.

First establish the project goal and sufficient outcome, then compare both
simpler contracts and implementation options by their contribution and total
cost. Simplicity is the default; complexity needs a meaningful benefit. We do
not have to exhaust increasingly elaborate fixes before reconsidering a
requirement we imposed on ourselves.

## When a fix keeps growing

Repeated patches, exceptions, flags, persisted state, and recovery branches
are a signal to revisit the approach. Before adding the next mechanism, name
the guarantee driving that complexity and ask whether users still need it.
Consider removing the feature, narrowing its supported cases, relaxing its
guarantee, or using an existing straightforward path. Accept some redo, delay,
or occasional manual action when the practical cost is reasonable.

For example, replace perfect resume with a fresh attempt, immediate handoff
with the existing bounded recheck, or automatic repair of a rare failure with
a visible error and a retry. Judge the simpler behavior against actual use.
If a costly guarantee is necessary, keep it and solve the real problem; if it
is not, change the guarantee rather than accumulate repairs around it.

Time already spent on the complicated approach is not a reason to continue.
Prefer the smallest end-to-end path that works under the revised contract.

## Robust enough for the goal

Robustness means useful, predictable behavior under the failures and variations
that matter to the project. Define what must keep working, what may degrade,
and what interruption, redo, or human intervention is acceptable. That belongs
in the sufficient outcome used to compare designs.

Simplicity often improves robustness: fewer dependencies, mutable copies,
handoffs, and special paths leave fewer ways to fail and make faults easier
to understand. Start by removing fragility. A straightforward path that can
be safely restarted can be more robust than elaborate partial recovery.
Simplicity alone does not establish adequate failure behavior, however.

Add protection when it addresses a credible failure whose consequences justify
the cost. A transaction can prevent partial state changes; a backup can make
lost state recoverable. Consider failure frequency, consequences, time to
restore useful service, and the human effort involved. Include the safeguard's
own failure modes, dependencies, and maintenance in the comparison. Rare but
unacceptable consequences can justify protection without waiting for an
incident; a low average failure cost alone does not settle the decision.

Extra cost need not mean more complexity. Spare capacity, a straightforward
backup, or cheap repeated computation can buy robustness while keeping the
design simple. Use the smallest measure that provides sufficient protection,
and verify the failure behavior that matters. Accept an explicit limitation
when stronger protection adds little practical value for its cost.

The rule is to choose the simplest design robust enough for the goal, and pay
for additional robustness when the avoided disruption is worth its total cost.

## What this means for technical choices

| Tradeoff | Usual choice | What justifies the additional mechanism |
| --- | --- | --- |
| Redo or precise resumption | Redo cheap, retry-safe work | Repeated work is expensive enough to justify saved progress and restoration |
| Agent judgment or code | Give the agent sufficient tools, wakes, and knowledge | A deterministic invariant or demonstrated repetition, unreliability, or cost makes code worthwhile |
| Direct call or event | Direct call for local ordered work; event for independent observation or admission | A real consumer, timing, or failure boundary needs decoupling |
| Specific module or generic framework | A small module with narrow dependencies | Actual variants share enough behavior that the abstraction reduces total complexity |
| Convention or configuration | A useful default and explicit ownership | A real deployment or user need must vary independently |
| Core or external capability | Keep varying policy and implementations outside the stable core | A shared correctness guarantee must hold across implementations |
| Preserve a contract or simplify it | Reconsider guarantees that cause disproportionate complexity | Preserve a costly guarantee when the real use case depends on it and weaker behavior is unacceptable |

These are applications of the decision order, not competing absolutes.
Event-driven does not require every call to be an event. Extensibility does
not require a plugin framework. Recovery does not require preserving every
step. Each serves an outcome and must justify its cost.

A meaningful tradeoff usually needs only a short explanation: the outcome,
essential constraint, chosen option, accepted cost, and evidence or condition
that would change the decision. Put it beside the relevant design or review;
no new approval process or document is required for routine choices.

For example, if a short report rarely fails and is cheap to regenerate, rerun
it. If interruptions repeatedly discard hours of expensive computation, a
coarse checkpoint may earn its cost. If an optional dashboard has no actual
consumer, omit it. These choices buy useful outcomes without paying for
unneeded precision or capability. Assumptions about frequency and cost should
come from the actual workload.

## Build what is suitable

Start with the real requirement and present situation. Learn from research,
other systems, and different opinions, then choose what helps our case. A
framework's elegance or popularity is insufficient reason to adopt it.
The smallest useful experiment may be the right next step; a recurring failure
may justify sustained investigation and a structural fix.

The early philosophy records Hao's explanation:

> “Don't just imp for design, imp for requirements!”

## Own the outcome

Understand the intent and why it matters. Carry authorized work through
execution, verification, and follow-up. Stay responsive and keep the human
informed without requiring repeated prompting. A real blocker needs evidence and a
clear next action. A report or successful tool call is enough only when it
fulfills the requested outcome.

Clear owners accumulate domain knowledge and take responsibility for results.
Delegation should add expertise, independent judgment, or useful parallelism.
Give the next owner enough context to decide, not just an instruction to repeat.
Keep human intent and authority explicit. Temporary steering must not quietly
become a permanent restriction or an invented requirement for human approval.

## Explore, verify, then harden

Agents need room to investigate unfamiliar problems. Test an idea before
promoting it into shared behavior. Once an approach works, capture the useful
parts in a skill, workflow, tool, or owned knowledge so later work becomes more
reliable. [Mechanism selection](code-vs-data.md) depends on what needs to be
controlled; these forms are not stages every idea must pass through.

Herdr Supervisor's [20/80 principle](core-principles.md#solidify-the-common-20-teach-the-remaining-80)
captures the balance: make common mechanics dependable and teach agents to
handle varied situations. Check their capabilities, wake path, and knowledge
before inventing another runtime feature.

The recurring loop is:

```text
reproduce -> explore -> verify -> adopt -> observe the effect -> refine
```

Keep the big picture, work on one focused problem, and verify the result before
adding another intervention. [Evidence First](evidence-first.md) explains the
experimental method; use verification appropriate to the uncertainty and risk.

## Learn without accumulating noise

Learning must improve later behavior. Keep useful context, evidence, and
reusable methods; consolidate or forget what no longer helps. Give agents
enough context and pointers to begin, then let them discover relevant detail.
Keep enough intent and evidence to continue or redo work after interruption.
Preserving every intermediate step or session is not a goal in itself.

Useful knowledge redundancy is allowed: a backup, summary, or local reminder
can improve resilience and recall. Copies need a purpose and aligned facts.
This does not create additional authorities for mutable Task state. Unread
copies and contradictory instructions should be removed.

## Keep independent judgment

Respect evidence and agreed responsibilities while allowing different
interpretations and alternative designs. Review should expose weaknesses and
change decisions when warranted. Agreement is earned through reasoning;
repeating a preferred answer is not alignment.

The early philosophy attributes this explanation to Hao:

> “The agent system is about common sense but not god truth”

## Measure useful progress

Judge whether the result solved the problem. Activity counts and adherence to
steps can help diagnose behavior, but they do not establish quality. Meeting a
metric should prompt a check that the metric still represents the goal.
Continue useful improvement and watch for regressions; finish bounded work
honestly when its outcome is achieved.

Efficiency comes from removing wasted discovery, unnecessary handoffs, and
repeated failures. An arbitrary tool-call quota that interrupts useful work
does not establish efficiency. Runtime capacity, cancellation, and recovery
still need explicit contracts.

## Keep explanations small and meaningful

Document the decision, its reason, and the evidence needed to judge it. Keep
runtime contracts with their owning documents, practical steps in manuals, and
dated research in the archive. Preserve useful rationale when shortening a
document. More principles, files, or process steps are not evidence of progress.

Use the [practical decision and review guide](core-principles.md#review-rule)
when choosing work, comparing designs, reconsidering a growing fix, or checking
an improvement's actual value. It applies the [tradeoff order](#how-to-decide-a-tradeoff)
through a few questions and a short decision note in the existing work context.
Read the detailed reasoning when it helps resolve the particular choice.
