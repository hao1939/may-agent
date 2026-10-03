# Make progress while input keeps arriving

**Supports:** [Task attempts](../2a-design/task-attempts.md). Turns admitted intent into useful results without waiting for the inbox to become quiet, supporting [May's purpose](../1-principles/purpose.md) of decreasing supervision and acceptable total cost.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [agent judgment and infra admission](../2a-design/task-attempts.md#agent-judgment-and-infra-admission), and [input during execution](../2a-design/execution-contributions.md#input-during-execution).

**Design status:** Scoped contribution acceptance and the ordinary-message/control distinction are accepted in the [Task contract](../2a-design/task-attempts.md#accept-work-and-continue-what-remains).
**Implementation status:** Candidate Host `d44c56ff6` implements that rule. The [PoC record](../archive/reviews/burst-input-progress-20261003.md#implementation-candidate-and-poc) contains deterministic results and limits. Review, deployment and observation of real agent behavior remain separate.

## Remaining work

The admission correction lets valid contributions accumulate while input keeps
arriving. It does not establish that an agent will choose useful work, fulfill
every requirement correctly or operate economically. Keep those questions
separate from the deterministic bookkeeping fix.

The original large-backlog no-op loop also had incomplete previous-result
context. Host #303 repaired that existing context path. Its small model trial
completed the assignment on both baseline and candidate; it did not reproduce
or resolve every historical repetition. See the
[context evidence](../archive/reviews/unfinished-input-context-20261003.md).

After source review and authorized deployment, observe representative bursts:
fulfilled outcomes, correction latency, oldest outstanding input, attempts per
useful result and token use. Include several messages refining one intention,
partial progress with a real wait, and work continued after correction.
Do not infer token savings or good judgment from fewer scripted attempts.

## Smallest implementation change

The implemented rule belongs to [Task attempts](../2a-design/task-attempts.md#accept-work-and-continue-what-remains);
current use belongs to the [Task execution guide](../2b-manual/task-execution-guide/SKILL.md#decide-how-this-attempt-ends).
The [implementation record](../archive/reviews/burst-input-progress-20261003.md#implementation-candidate-and-poc)
replaces the completed path-by-path proposal. The schema, Task identity,
Conditions, input records and scheduler remain the existing mechanisms.

An ordinary correction is interpreted at a later decision boundary and may
revise accepted work. It does not promise instantaneous withdrawal of an
already prepared action. Explicit Stop, affected requirement revisions and
authorization checks retain their control meaning. Trial that convention in
actual use before claiming adequate steering responsiveness.

## Sustained overload and repeated non-progress

If accepted work arrives faster than it can be completed, the backlog grows
even with correct settlement. The owner must prioritize, narrow scope, defer
with an accountable decision or add suitable capacity. Preserve service for
older eligible requirements; do not silently drop distinct asks or use
"latest message wins" to replace cumulative requirements.

Existing metrics and Evaluation should distinguish contributions accepted,
requirements fulfilled, artifacts produced, genuine waits and interventions
actually applied. A completed attempt alone is not evidence of useful progress.
An unchanged input count is a signal, not proof of waste: independent work can
still advance a requirement. Use those observations to decide whether further
App policy or guidance is justified; do not add a second input controller or
fixed retry cutoff without evidence.

## Acceptance evidence still needed

Portable regressions cover incremental acceptance, retained input across
restart, live/final actions, requirement changes, workspace reuse, exact Stop,
revision conflicts and atomic failure. Remaining evidence concerns deployment
and representative agent behavior, especially the original large unfinished
assignment, sustained load and corrections arriving during expensive actions.
A bounded model comparison should use the same work and measure fulfilled
outcomes and cost. No additional model experiment or production restart was
performed for this candidate.
