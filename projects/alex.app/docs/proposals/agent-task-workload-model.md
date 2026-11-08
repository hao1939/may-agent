# Agents, Tasks and workload feedback

**Supports:** [Agent Task ownership](../2a-design/agents.md#task-ownership-and-app-scope).
Keep useful work moving under changing demand while bounding outstanding
commitments, execution and cost.

**Choice basis:** [Purpose and value](../1-principles/purpose.md) and
[simple first](../1-principles/core-principles.md#simple-first).
Use one admission rule for independent assignments and inherited allowances for
contributions. This permits cooperation without multiplying budgets or making
every observation a new assignment.

**Design status:** Draft for review.
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

A root Task represents one admitted independent assignment. Its descendants are
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

2. **Allow useful work to remain pending.** An agent may accept a Task while
   execution capacity is full. Set a limit `K` on outstanding independent
   assignments, including pending work, separately from limit `C` on executing
   attempts. `K` can be larger than `C`. Reserve a finite work allowance `B` for
   each admitted root from the sponsoring agent's available budget, and set its concurrency allowance
   `c`. Accepted input awaiting admission stays durably pending with a visible
   disposition. Spare admission or execution capacity is permission to consider
   useful work, not an obligation to invent it.

3. **Children inherit admission and share resources.** An executing agent may
   request durable contributions within the root's delegated authority. Every
   descendant, retry and required follow-through retains that root's allowance;
   another contributing agent also applies its own execution and permission
   limits. Children acquire no new independent-assignment slot or budget. A new
   unrelated outcome requires independent admission. Trusted admission records,
   not structural parent links or model-supplied labels, establish attribution.

4. **Creation and execution both consume the allowance.** The Host atomically
   reserves resources before accepting them. Task creation has a positive
   resource charge, so finite `B` bounds generated records as well as execution.
   Large decompositions create children incrementally. Replaying the same
   admission does not charge again; closing a Task does not refund spent work.
   Budget exhaustion remains visible and needs a creator-authorized decision;
   retry, revision or delegation cannot silently replenish it.

5. **Yield execution while retaining responsibility.** A parent that has no
   useful independent work yields its attempt while awaiting a child. It retains
   admission and outstanding requirements but releases execution capacity. At
   most `c` attempts execute across the assignment and its descendants, subject
   to each agent's `C` and the shared Host limit. With `c = 1`, the parent yields,
   the child runs, and its result wakes the parent. Bounded helpers stay inside
   their caller's execution scope and shared spending allowance.

6. **Return results, review and end assignments explicitly.** The assigned
   agent reports evidence; the creator consumes it and retains, revises, closes
   or cancels the assignment through authorized controls. Ending an attempt or
   accepting a result does not itself close a Task. The root's admission slot
   remains occupied while its descendants or accepted requirements remain
   unresolved, even if the root record was closed. Input delivery and result
   recording need no new assignment slot. Reserve one shared Host execution slot
   for coordination and human interaction, with a bounded allowance independent
   of ordinary assignment budgets. This is available capacity, not a continuously
   running agent or a physical slot per agent. A one-slot Host instead prioritizes
   coordination between bounded attempts so ordinary work can still run.

## Workload feedback

The Host supplies current resource and Task facts. Each agent applies the same
short decision rule through its existing coordination Task:

| Current situation | Next decision |
| --- | --- |
| Runnable admitted work can use available execution slots | Advance it; keep discretionary expansion behind existing commitments. |
| Execution capacity stays spare, fewer than `K` assignments are funded, and budget remains | Select at most one useful outcome from authorized goals and admit it. |
| Execution capacity is spare but assignments are blocked or awaiting disposition | Resolve blockers, consume results and review closure before expanding. Useful independent work can still proceed within available allowances. |
| No worthwhile authorized work or no available spending allowance | Remain quiet and wait for relevant input or a justified review time. |

One assignment slot becoming free or a sustained shortage of runnable work may
wake coordination. Coalesce repeated notifications, bound each review and use a
cooldown after an empty planning pass. Routine sampling and an unchanged idle
condition do not each invoke a model. Keep `K` and concurrency limits fixed in
the first version; feedback adjusts the admission rate. Change limits only from
observed waiting, completion quality, blocked work and total cost.

## A simple capacity graph

Use the [interactive capacity map](agent-task-workload-graph.html) to vary `i`,
`j` and `k` for three identical agents. Every common interval `i`, each agent
receives on average `j` new independent Tasks and has capacity for `k` work
completions. Closed work leaves the live population; pending work uses no
execution slot. Treat contribution costs as already included in the rates.
This baseline accepts all arrivals without an admission limit or feedback; it
shows the pressure those controls must address. A `K` limit bounds admitted
assignments, while excess input still needs to be deferred or declined explicitly.

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

Alex has `K = 2` independent assignments and execution limit `C = 2`.
Its coordination Task receives a metric breach. Alex admits investigation A
with finite `B` and `c = 2`. A requests a diagnostic contribution from Bob and
an independent review. Those children share A's allowance; neither receives
another root slot. Required review consumes that same allocation.

Further observations for A's alert episode become evidence for existing work.
A genuinely separate investigation needs another admission decision. When A is
waiting on Bob it releases execution capacity. If capacity stays spare and Alex
has budget and a free root slot, it may admit a useful assignment B. Once A's
results and remaining contributions are disposed of, creator closure releases
its slot. If nothing useful remains, Alex stays quiet.

The lock analogy describes reusing an existing admission: a child never waits
for the root slot already held by its own assignment. Execution uses a shared
concurrency allowance, so siblings may run together. This analogy grants no
permission to bypass another agent's limits, run concurrent attempts of one
Task, or hold an execution slot while waiting for a durable child.

## Implementation boundary and verification

This proposal changes admission and accounting policy, not Task identity,
Conditions, result correlation, creator authority or the existing recovery loop.
Direct and App-addressed input, Conversation handoff, durable delegation and
event mappings must pass the same accounting boundary. Reopening reacquires the
applicable allowance. Bootstrap, standing work and historical imports must be
accounted for explicitly rather than become unrestricted creation paths.

An implementation must define the unit and charge schedule for `B`, retain
reservations and root attribution across restart, fence concurrent admissions,
and preserve idempotent caller/result links. Budget allocation is separate from
who may revise or close a Task. Historical storage retention remains a separate
concern: ending work preserves evidence and does not reclaim records.

Budget state belongs in the Host's existing durable store. Tasks and execution
contexts carry a shared budget reference. Short atomic transactions reserve
credits and capacity with admission and attempt claims; execution holds a
reservation rather than a database lock. Child spending must not mutate the root
Task's execution version. Recovery reconciles reservations with actual attempts
and confirmed cleanup before releasing reusable capacity.

Verify at least these contrasting cases: a burst of metric observations reuses
accountable work; parallel admissions respect `K`; nested cooperation with
`c = 1` makes progress; delegation and retries preserve shared spending across
restart; exhaustion still permits bounded creator review; parent closure cannot
release a slot while contributions remain unresolved; sustained spare capacity
admits useful authorized work and an empty planning pass stays quiet.
These are proposed verification cases, not tests run or deployment claims.
