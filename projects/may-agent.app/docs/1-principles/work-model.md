# Choosing a work mechanism

**Supports:** [Design Philosophy](design-philosophy.md#own-the-outcome). Matches responsibility to the smallest useful mechanism, avoiding unnecessary coordination and repeated planning.

**Choice basis:** [Match the mechanism to the responsibility](core-principles.md#match-the-mechanism-to-the-responsibility).

**Design status:** Accepted.

Read [System Model](../2a-design/system-model.md) for the vocabulary and complete
work loop. This page helps choose a mechanism; the linked contracts own its
behavior. [Working on a Task](../2b-manual/task-execution-guide.md) explains use.

## Choose by responsibility

| Need | Start with | Why it earns its place |
| --- | --- | --- |
| Discuss, investigate or complete a bounded ask with the human | Conversation | Keeps joint work interactive without unnecessary handoff |
| Preserve independent work across executions | An App-owned Task | Retains requirements, accepted outcomes and continuation |
| Make an uncertain decision or perform novel work | An agent within the current execution | Applies judgment without prescribing a procedure prematurely |
| Reuse situational judgment guidance | A skill | Makes a method discoverable when relevant |
| Preserve a useful ordered procedure | A workflow | Executes explicit steps and checks while asking an agent where needed |
| Receive a needed external fact | A Condition and a supported observation/return path | Retains the interest without model polling |
| Reconsider work at a useful time | A schedule or declared review checkpoint | Supplies time as input; it does not own work |
| Record or translate a mechanical fact | A handler, observer, metric or projection | Keeps predictable bookkeeping in code |
| Obtain another owner's contribution or authority | An addressed request | Preserves responsibility and returns evidence through the declared path |

Frequency alone does not justify a workflow, and a cross-App call alone is not
an escalation. Choose an App boundary when responsibility, expertise or authority
differs. Direct bounded helpers need no independent durable Task unless their
promised work must outlive the call. See [contributions](../2a-design/execution-contributions.md).

## Keep judgment and execution together at the right scope

An agent can read, act, test and repair repeatedly within an attempt. A workflow
preserves a useful procedure for those actions; it does not own another Task
lifecycle. An ordinary failed test or rejected hypothesis can be in-scope work,
not automatic escalation. Return to the accountable owner when scope, authority
or the procedure itself needs a decision.

Infra retains and schedules work; the agent judges what can usefully proceed.
A Condition can remain outstanding during independent work. When only external
facts remain, yield through the [attempt result](../2a-design/task-attempts.md)
and let infra execute the return path. Do not build a polling loop in the model.

## Keep views and evidence in their scope

[Project posture](../2a-design/projects.md) expresses the domain's overall state.
[Task lifecycle](../2a-design/task-resource-engine.md) describes durable work and
execution eligibility. A session, workflow run or metric supplies evidence; it
does not become a second completion authority. Accepted worker judgment is
usable by default, subject to App acceptance policy and later correction.

Reusable experience belongs in the smallest useful home: domain knowledge,
guidance, a skill, a tested procedure or an infra fix. Use [Code vs Data](code-vs-data.md)
and [Evolution](evolution.md) when deciding how to preserve it. Do not promote
every successful one-off action into a permanent mechanism.
