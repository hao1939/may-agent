# Agents, Tasks and workload feedback

**Supports:** [Agent Task ownership](../2a-design/agents.md#task-ownership-and-app-scope).
Keep useful work moving under changing demand, make commitments explicit and
bound execution and spending.

**Choice basis:** [Purpose and value](../1-principles/purpose.md),
[simple first](../1-principles/core-principles.md#simple-first) and
[agents judge; infra executes](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
Business need establishes the assignment; workload makes the opportunity cost
of taking it on visible. Agents judge priorities and scope, while the Host
enforces authority and resource bounds. Shared allowances permit cooperation
without multiplying budgets or making every observation a new assignment.

**Design status:** Accepted direction for the mental model and workload behavior.
Budget units, charging and runtime integration remain proposed implementation work.
**Implementation status:** Proposed. Agent ownership, creator-controlled revision
and closure, bounded attempts and Host concurrency exist. Direct agent admission,
the shared allowances and workload feedback below are not implemented by this
document. Current durable admission still requires an App. The
[standalone-agent proposal](standalone-agent-tasks.md) owns that addressing change.

## The mental model

**Agents accept and organize work. Tasks preserve assignments. The Host executes
and keeps the records.**

| Concept | Meaning |
| --- | --- |
| Agent | A durable identity with policy, knowledge, capabilities and a resource allowance. It judges input and owns delivery of assigned outcomes. |
| Task | A durable assignment with an outcome, acceptance criteria, assigned agent, recorded creator, evidence and unresolved work. |
| Attempt | One bounded execution of a Task; it can finish while the assignment remains open. |
| Host | Validates and persists decisions, runs attempts, enforces resource limits and returns feedback. |

An App can package shared context and capabilities; it adds no second
decision-maker or Task owner. The assigned agent chooses methods and reports
results. The recorded creator controls requirements and assignment closure.
The sponsoring agent supplies the resource account for a root; funding does
not change delivery ownership or creator authority.

A Task records a justified assignment and can remain pending without an execution
slot. Accepting it does not promise immediate execution or establish a delivery
date. The agent makes waiting, priority and delivery conflicts visible to its
caller. Completing an attempt, satisfying an input and closing the assignment
remain separate decisions under the existing lifecycle.

A root Task represents one independent assignment. Its descendants are
contributions to that assignment. The root identity also identifies their shared
allowance; it introduces no second work lifecycle. A standing coordination Task
lets an agent consider input and review results through the ordinary Task engine.
Its work has a small, explicit allowance of its own.

## Six rules

1. **Input reaches an agent before it becomes new work.** Human requests,
   metric breaches, schedules, observations and research findings are inputs.
   The responsible agent or its declared policy decides whether to advance an
   existing Task, admit an independent assignment or record no action. Repeated
   evidence can be batched while preserving exact caller obligations. A timer or
   metric alone grants neither authority nor another Task budget.

2. **Judge the need and make the commitment explicit.** Required business work
   can become a pending Task while execution capacity is full. Workload alone
   does not invalidate its need. Preserve the obligation and explain priority,
   waiting and delivery conflicts. Discretionary work must justify the effort
   and delay it imposes on existing commitments; pressure raises that threshold.
   If a request cannot be accepted, return an explicit disposition through the
   existing caller path. Input awaiting a decision remains durably visible.
   Spare capacity permits useful expansion without requiring invented work.

3. **Children share their assignment's resources.** An executing agent may
   request durable contributions within the root's delegated authority. Every
   descendant, retry and required follow-through retains that root's allowance;
   another contributing agent also applies its own execution and permission
   limits. Set a finite work allowance `B` and concurrency allowance `c` for each
   independent assignment, backed by its sponsoring agent's resources. Children
   acquire no independent budget. A new unrelated outcome requires its own
   authorized assignment and allowance. Trusted admission records,
   not structural parent links or model-supplied labels, establish attribution.

4. **Creation and execution both consume the allowance.** The Host atomically
   reserves credits against the root allowance and sponsor's available credits
   before each charged operation. Creating a pending root consumes only its
   record-creation charge, not the full allowance `B`. Descendant creation and
   execution charge that same root allowance. A pending Task uses no execution
   slot. Positive creation charges bound generated records within the available
   spending allowance;
   large decompositions create children incrementally. Replaying an admission
   does not charge again, and closing a Task does not refund spent work. If
   credits are unavailable, retain the input or assignment with its actual
   disposition and seek an authorized funding or scope decision. Retry,
   revision and delegation cannot silently replenish the allowance.

5. **Yield execution while retaining responsibility.** A parent that has no
   useful independent work yields its attempt while awaiting a child. It retains
   its assignment and outstanding requirements but releases execution capacity.
   At most `c` attempts execute across the assignment and its descendants, subject
   to each agent's `C` and the shared Host limit. With `c = 1`, the parent yields,
   the child runs, and its result wakes the parent. Bounded helpers stay inside
   their caller's execution scope and shared spending allowance.

6. **Return results, review and end assignments explicitly.** The assigned
   agent reports evidence; the creator consumes it and retains, revises, closes
   or cancels the assignment through authorized controls. Ending an attempt or
   accepting a result does not itself close a Task. Pressure can bring this
   review forward; completion still requires evidence against the agreed scope.
   Cancellation or reduced scope needs the creator's explicit decision and a
   recorded reason. It must not be reported as delivery of the original outcome.
   Closing a root does not settle unresolved descendants, release their active
   reservations or erase accepted requirements. Input delivery and result
   recording need no new assignment execution budget.

Reserve one shared Host execution slot for coordination and human interaction,
with a bounded allowance independent of ordinary assignment budgets. This keeps
priority, funding and closure decisions reachable under pressure. It is available
capacity, not a continuously running agent or a physical slot per agent. A
one-slot Host instead prioritizes coordination between bounded attempts so
ordinary work can still run. Coordination itself remains bounded; backlog does
not authorize unlimited review work.

## Workload feedback

**Honor existing obligations, spend spare capacity on useful expansion, and use
workload pressure to reconsider priorities and commitments.**

The Host supplies current resource and Task facts through existing reads and
attempt context. Show runnable work and available execution capacity, pending
and blocked work, results awaiting review, waiting time and remaining credits.
Agents interpret those facts alongside business value, deadlines and expected
effort, using estimates only where useful. Ten blocked Tasks and ten urgent
runnable Tasks should not produce the same decision merely because both count
as ten. The first version needs neither a universal pressure score nor a fixed
admission formula.

Task count is supporting context. If `K` is used as a workload reference, crossing
it prompts review; it is not an automatic rejection or closure threshold. Hard
limits apply to spending, permissions and executing attempts (`C` per agent,
`c` across a root and its descendants, plus the shared Host limit). These limits
do not establish whether an assignment is valuable or complete. Any separate
installation intake or storage quota must return an explicit deferred or refused
disposition, preserving already accepted obligations.

Each agent uses a bounded pass of its existing coordination Task to review
changed obligations and evidence, choose valuable next work and make necessary
priority, funding or scope decisions. Workload influences that judgment:

| Decision | With spare capacity | Under workload stress |
| --- | --- | --- |
| Required work | Advance it and make delivery expectations visible. | Retain its need; prioritize urgency and value, explain conflicts and renegotiate commitments when necessary. |
| Discretionary work | Consider a useful authorized improvement or experiment. | Require enough benefit to justify delaying existing commitments; defer or decline low-value expansion. |
| Scope and execution | Use an appropriate method and depth for the agreed outcome. | Seek the smallest sufficient outcome; obtain creator authorization for changed acceptance criteria. Reprioritize at safe attempt boundaries. |
| Cooperation | Delegate where specialist skill or parallel capacity helps. | Check the recipient's capacity and coordination cost; delegation preserves the root budget and caller responsibility. |
| Review and closure | Review results and stale work regularly. | Review blockers, already sufficient results, duplicates and obsolete work sooner; retain the same evidence and authority requirements. |

Required and discretionary describe business judgments, not new Task types.
When execution is idle because work is blocked, resolve useful blockers and
consume results before expanding. Independent work may still proceed when its
value and allowances justify it. When no useful authorized work remains, idle
capacity is appropriate. Neither maximum utilization nor minimum live Task
count is the objective.

Relevant input, a returned result, a meaningful change in capacity or sustained
shortage of runnable work may wake coordination. Coalesce repeated notifications,
bound each review and use a cooldown after an empty planning pass. Routine
sampling and an unchanged idle condition do not each invoke a model. No separate
controller agent is needed. Limits and acceptance criteria do not automatically
change with the pressure signal.

The expected benefit is less low-value expansion during overload, useful
exploration when capacity is spare and faster disposition of completed or
obsolete work. Feedback adds no physical capacity. If required demand exceeds
completion capacity, waiting grows until demand, commitments or capacity change;
the agent must surface that conflict. Deferring a request moves outstanding
demand elsewhere and must remain visible. Cancellation is a business decision,
not evidence of improved delivery throughput.

## A simple capacity graph

Use the [interactive capacity map](agent-task-workload-graph.html) to vary `i`,
`j` and `k` for three identical agents. Every common interval `i`, each agent
receives on average `j` new independent Tasks and has capacity for `k` work
completions. Closed work leaves the live population; pending work uses no
execution slot. Treat contribution costs as already included in the rates.
This baseline accepts all arrivals without an admission limit or feedback; it
shows the pressure agents must interpret. Colors indicate demand relative to
capacity; they do not prescribe rejection or closure. Future feedback analysis
can separate required arrivals from discretionary expansion, since agents can
reduce the latter more directly. Record delivered outcomes, cancellations and
deferred demand separately rather than treating all disappearance as completion.

Total arrival rate is `lambda = 3j/i`; work capacity is `mu_work = 3k/i`.
With prompt creator closure, effective capacity is `mu = mu_work`. An optional
shared management limit changes it to `mu = min(mu_work, mu_close)`.
Load is `rho = lambda/mu`; excess demand grows at `max(0, lambda - mu)` Tasks/minute.
The fluid backlog after time `t` is `max(0, initial + (lambda - mu)t)`.

The graph uses `j` and `k` as its axes. Color can show load or growth per hour;
clicking selects the inputs for a backlog projection. With common `i`, the
worker load ratio `j/k` stays unchanged when `i` changes. Growth per minute and
the effect of a fixed management rate can change. Equal arrival and service
rates have no stochastic headroom: a flat fluid line is not a prediction of
zero random waiting. This is rate analysis, not a simulation of agent behavior.

## One example

Alex has execution limit `C = 2` and is working on a required repair and an
optional investigation. Both use their own finite root allowance `B`.
Its coordination Task receives a metric breach. Repeated evidence for the repair
updates that assignment. A critical new incident becomes a pending Task
even while both execution slots are occupied. Alex defers the optional
investigation at a safe boundary and advances the incident when credits and a
slot are available. Any delivery conflict is reported to the relevant creator.

The repair requests a diagnostic contribution from Bob with `c = 1`. Its parent
yields execution while waiting, so Bob can run within that root's shared budget
and his own limits. Delegation creates no capacity or credits. Workload pressure
does not make the repair complete while Bob's required result is outstanding.
An already sufficient result can receive earlier creator review; obsolete
optional work can be explicitly cancelled with its reason and caller disposition.

When useful runnable work becomes scarce and credits remain, Alex can consider
another improvement under authorized goals. If no worthwhile work exists, it
stays quiet. There is no requirement to refill a Task count.

The reentrant-lock analogy applies only to shared budget attribution: children
reuse the root allowance rather than acquiring another independent budget.
Execution uses a shared concurrency allowance, so siblings may run together
when `c` permits it. The analogy grants no permission to bypass another agent's
limits, run concurrent attempts of one Task, or retain an execution slot while
waiting for a durable child.

## Implementation boundary and verification

This proposal changes admission and accounting policy, not Task identity,
Conditions, result correlation, creator authority or the existing recovery loop.
Direct and App-addressed input, Conversation handoff, durable delegation and
event mappings must pass the same accounting boundary. Reopening retains root
attribution and spent charges; additional funding needs authorization. Bootstrap,
standing work and historical imports must be accounted for explicitly rather
than become unrestricted creation paths.

An implementation must define the unit and charge schedule for `B`, retain
reservations and root attribution across restart, fence concurrent admissions,
and preserve idempotent caller/result links. Budget allocation is separate from
who may revise or close a Task. Historical storage retention remains a separate
concern: ending work preserves evidence and does not reclaim records.

Budget state belongs in the Host's existing SQLite-backed durable store. Tasks
and execution contexts carry a shared budget reference. Short atomic transactions
reserve credits and capacity with admission and attempt claims; execution holds a
reservation rather than a database lock. Child spending must not mutate the root
Task's execution version. Recovery reconciles reservations with actual attempts
and confirmed cleanup before releasing reusable capacity.

There is one authoritative budget ledger for the Host's runtimes, not replicated
per-agent counters or a separate distributed lock. A pending record needs its
creation charge, not full execution funding. Authority to accept input or close a
Task remains separate from authority to spend. A failed operation must leave
its actual disposition available through the existing input/result path.

Verify these contrasting cases before claiming the feedback improves behavior:

| Case | Expected behavior |
| --- | --- |
| Same required incident under light and heavy workload | Preserve its need in both; pressure changes priority and delivery expectations, not acceptance by Task count. |
| Same discretionary opportunity under light and heavy workload | Consider expansion when useful capacity exists; under pressure require enough value to displace existing work. |
| Idle execution with blocked assignments | Review actual blockers; do not infer missing business work from low utilization. |
| High backlog with an incomplete Task and an already sufficient result | Keep the unmet obligation; bring sufficient evidence to creator review without lowering criteria. Cancellation remains a separate disposition. |
| Burst of repeated metric observations | Reuse accountable work where appropriate, preserving exact caller obligations. |
| Nested cooperation with `c = 1`, including restart | Yield so the child can run; preserve shared charges, attribution and responsibility. |
| Concurrent claims, retries and exhausted credits | Enforce `B`, `C`, `c` and Host bounds without double charging; retain visible work and bounded creator coordination. |
| Parent closure while a child remains unresolved | Preserve child obligations and active reservations until their actual disposition and cleanup. |
| No useful work after a planning pass | Stay quiet until relevant input or a justified review time. |

Use the same business scenarios under different loads and inspect actual agent
decisions, fulfillment, waiting, discretionary effort and review cost. Smaller
Task counts or more closures alone do not establish improvement. These are
proposed verification cases, not tests run, behavioral evidence or deployment
claims. Reconsider additional control machinery only if observed decisions or
resource enforcement remain inadequate.
