# Choosing the Right Mechanism

**Supports:** [Design Philosophy](design-philosophy.md#what-this-means-for-technical-choices). Chooses the smallest mechanism that addresses the actual cause.

**Choice basis:** [Design Philosophy](design-philosophy.md#how-to-decide-a-tradeoff).

**Design status:** Accepted.

Start from the cause of the problem, not the mechanism you happen to know.
When several mechanisms fit, compare them using the
[fundamental tradeoff rules](design-philosophy.md#how-to-decide-a-tradeoff).

## Before adding runtime behavior

First ask whether the feature or guarantee is needed at all. If a fix keeps
growing, revisit that question before adding another mechanism; see
[When a fix keeps growing](design-philosophy.md#when-a-fix-keeps-growing).
Then apply the Herdr Supervisor agent-first test:

1. Can the agent handle the case with existing observation and action tools?
2. Will an existing event or bounded check reliably wake it?
3. Does it receive enough current evidence, goal context, and durable guidance?

If all three hold, use the existing path. Improve the guidance if needed.
If one is missing, fix that specific capability, trigger, or context gap.
Add further automation only when measured reliability or cost gains justify
its implementation and maintenance. An explicit guide can remain guidance;
it need not become a workflow or code branch.

Keep deterministic correctness checks in code. Use the decision guide below
when evidence shows the existing foundation is insufficient. This applies the
[20/80 principle](core-principles.md#solidify-the-common-20-teach-the-remaining-80)
without imposing a numerical budget or another review gate.

## Code should help agents work

Code exists to make agents more effective: reliable actions, useful observation,
evidence retention, recovery and less repetitive bookkeeping. A procedure is
valuable when it improves the outcome; following more steps is not progress.
Keep agents responsible for meaning, tradeoffs and sufficiency. A fresh judgment
must be able to change the approach, reuse sound work or conclude that no edit
is needed, within the current requirement and authority.

When reviewing a tool or workflow, ask:

- Does it give the agent a useful capability or remove repeated mechanical work?
- Does each mandatory step protect a real invariant, authority boundary or
  explicit acceptance requirement? Could guidance or an optional tool suffice?
- Can the agent inspect enough evidence, choose a different approach and recover
  without the human reconstructing the run?
- Does failure explain what happened and preserve useful work, or does it force
  another full attempt simply because delivery or formatting failed?
- Do observed completion quality, unnecessary repeats and human intervention
  improve? Measure those effects instead of procedural compliance alone.

Retain checks for actual effects, identity, authority and result correctness.
Revisit routing rules, history cutoffs and tool restrictions when they prevent
useful judgment or investigation. A narrow workflow may deliberately serve one
outcome; do not make all work adopt that process merely to access a shared
capability such as saving evidence.

## Decision guide

```text
Is this one novel or ambiguous decision?
  -> let the accountable agent judge it directly

Is this reusable guidance whose application depends on context?
  -> skill or owned knowledge

Is this routine delivery retry, backoff or replay of the same operation?
  -> the owning infra capability, under the shared execution contract

Is a stable domain sequence, recovery method or verification repeatedly missed?
  -> agent-owned workflow

Is this a deterministic fact or invariant?
  -> code, test, schema, or tool

Is this a mechanically detectable execution risk?
  -> observe/warn guard first; block only after evidence

Is a new external action unavailable?
  -> tool or SDK capability

Does work need durable ownership across multiple executions?
  -> an accountable App and one Task

Does existing behavior only need a wake or observation?
  -> event, schedule, watcher, metric, or small handler
```

These mechanisms compose. A scheduled task may bind a workflow whose agent
steps use skills and tools while guards observe mechanical risk.
Agents and workflows may choose retries or failover as recovery actions; infra
executes them. A domain repair loop does not become a delivery retry controller.
See the [retry ownership contract](../2a-design/system-boundary.md#retry-and-recovery-ownership).

## Examples

| Need                                              | Mechanism                                  | Why                                             |
| ------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Current repository path or credential location    | Owned context                              | Environment-specific fact                       |
| Investigate one unfamiliar failure                | Direct agent session                       | Novel judgment                                  |
| Apply a known review method across varied changes | Skill                                      | Reusable guidance, context-sensitive use        |
| Always implement, test, then independently review | Workflow                                   | Stable ordered process                          |
| TypeScript must compile                           | Test/code                                  | Deterministic invariant                         |
| Detect likely secret material in writes           | Observable guard, then calibrated blocking | Mechanical risk with measurable false positives |
| Call a provider API                               | Tool                                       | Explicit external capability                    |
| Maintain a domain goal over time                  | App Task                                   | Durable owner and state                         |
| Recheck provider readiness                        | Watcher event plus Condition               | External level observation                      |

## Why not default to prompt rules or blocking guards?

Text reminders are weak when the real problem is missing structure. Blocking
guards are harmful when the detector encodes changing environment assumptions
or subjective interpretation.

Before adding a blocking guard, require:

1. a mechanically identifiable signal;
2. repeated evidence that observation or warning is insufficient;
3. measured false positives;
4. a clear intervention point and owner; and
5. a regression or Gym scenario proving that blocking improves the outcome.

Before adding a workflow, require:

1. a repeatable process rather than one novel task;
2. explicit inputs, outputs, bounds, and terminal conditions;
3. evidence that preserving the sequence is valuable; and
4. tests or verification appropriate to its risk.

## Prefer deletion and reuse

Check for an existing convention, skill, workflow, tool, SDK capability,
Condition type, or handler before adding another. Retire mechanisms when they
duplicate a clearer owner or no longer improve outcomes.

See [evolution.md](evolution.md) for promotion and retirement and
[work-model.md](work-model.md) for the complete work loop.

## Composition preserves execution rules

A workflow is orchestration of agent operations. It uses the same ownership,
input observation, permission, cancellation and recovery rules as those
operations. Code handles predictable execution and retains evidence; agents
choose methods and judge changing requirements. `await` expresses a dependency
within an active attempt; durable events and Task state coordinate work across
attempts. See [Workflow execution](../2a-design/execution-contributions.md#invocation-and-ownership).

Standardize those execution guarantees, not a universal procedure. Participants,
step order, review methods, private parameters and evidence applicability belong
to the owning App. A declared required check remains enforceable until the
procedure or accepted requirement changes; flexibility comes from useful decision
points and returning control when the method no longer fits. See
[shared contract and changeable procedure](../2a-design/workflows.md#shared-contract-and-changeable-procedure).
