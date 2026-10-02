# Metric Alert Manual

**Supports:** [Metrics And Alerts](../2a-design/metrics.md). Turns metric evidence into owned investigation without confusing a breach with a diagnosis.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

A metric alert is an observation that may need judgment. It is not a Task,
owner inbox item, or automatic instruction to change the system.

The normal flow is:

```text
measurement -> metric rule -> breach or recovery fact
                         -> explicit App route, exact Task wake, or observation
```

No route means the fact remains observable. The Host must not guess an owner,
create a Task, or fall back to May.

## 1. Verify the observation

Read the metric definition, current value, threshold, priority, source,
sampling window, latest samples, and open alert. Confirm:

- the source still exists and ran recently;
- the value and unit have the documented meaning;
- the alert rule really matches the current value;
- the sample is fresh enough to support a decision; and
- a known blind spot does not invalidate the conclusion.

A stale, duplicated, or malformed observation is a measurement problem, not
evidence that the measured domain failed.

## 2. Find the declared responsibility

The metric definition may attribute the observation to an App or project, but
attribution alone does not create work. Check the installed App declaration for
an explicit matching subscription, Task selector, Condition, or observation
route.

| Route                        | Meaning                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| App input or Task selector   | The App intentionally turns this fact into desired work     |
| Exact Task or Condition wake | Existing work should reconsider the new fact                |
| Observation-only             | Retain it for health and audit; create no work              |
| No declared route            | Record a routing/design gap if action is genuinely required |

Do not edit `metrics.owner` during triage to force routing. Fix the metric
definition or App declaration through ordinary reviewed code when responsibility
is wrong.

## 3. Choose the smallest justified response

The accountable App decides what the observation means in the context of its
current Task. Common responses are:

- **No action:** evidence shows the alert is expected, transient, or not useful
  enough to drive work.
- **Fix the cause:** continue or create one Task whose outcome is the actual
  repair, then verify with fresh domain evidence.
- **Repair measurement:** correct a broken source, query, unit, or sampling
  path and rerun the measurement.
- **Calibrate:** change threshold, target, priority, or rule only with evidence
  that the old definition did not represent the intended question.
- **Retire:** stop measuring a question that no longer informs decisions while
  preserving its history.
- **Accept an exception:** record why the current breach is understood, its
  scope, and the fact that should trigger review.
- **Request a human decision:** expose one exact requested action on the owning
  Task when policy, risk, or irreversible effects require it.

Do not create a cleanup Task merely to make the dashboard green. The Task goal
must describe the real outcome, not “handle alert.” Repeated observations for
the same outcome should wake or update that Task rather than create siblings.

## 4. Apply changes through normal boundaries

- App/workflow code uses `ctx.metrics` for definitions, samples, evaluation,
  and explicit alert resolution.
- Task changes return through the normal reconciliation result.
- Human input returns through an exact Condition or typed feedback to the same
  Task.
- Runtime or schema changes follow the maintenance App's authorized procedure.
- Raw writes to `.state/*.db`, `metrics`, `metric_alerts`, Tasks, or Event rows
  are not an operational shortcut.

If the current attempt lacks authority for the needed action, return evidence
and request the accountable App outcome. Do not send an untracked message and
assume somebody will act.

## 5. Close with fresh evidence

After a repair or calibration, record a fresh sample and run
`MetricService.evaluate()`. `metric.recovered` means the rule no longer
breaches; it does not by itself prove the related Task outcome is complete.
The App verifies its own acceptance criteria before converging the Task.

Manual alert resolution is appropriate only for a proven duplicate, invalid
row, retired definition, or explicitly accepted exception. Preserve the reason
and evidence through the supported metric capability.

## Audit checklist

- Did current source evidence confirm the breach?
- Is responsibility declared by an App route rather than guessed from a name?
- Does any Task represent a real durable outcome rather than alert bookkeeping?
- Did repeated evidence continue the same Task where appropriate?
- Were all mutations applied through typed App/Runtime capabilities?
- Does fresh evidence support recovery, calibration, retirement, or exception?
- Is human attention concrete and attached to the Task that will resume?

See [Metrics And Alerts](../2a-design/metrics.md) for the governing design.
