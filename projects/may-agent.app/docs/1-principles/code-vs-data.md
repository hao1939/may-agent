# Choosing the Right Mechanism

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

## Decision guide

```text
Is this one novel or ambiguous decision?
  -> let the accountable agent judge it directly

Is this reusable guidance whose application depends on context?
  -> skill or owned knowledge

Is a stable sequence, branch, retry, or verification repeatedly missed?
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
