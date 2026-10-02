# App Adoption Checklist

**Supports:** [App Contract](../2a-design/agent-app.md). Applies App ownership and admission conventions to a new domain.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

Use an App for a durable responsibility with typed inputs and acceptance rules.
Begin with the [SDK Quickstart](sdk-quickstart.md) and its checked example;
this checklist adds the decisions needed for your own domain.

## Define responsibility and identity

- Choose one App address and describe the outcome it owns.
- Declare a specific input schema and an available default agent.
- Enable Task policy with `tasks` and map durable input through `task(request)`.
- For a new App, seed the structural root referenced by its Task intents, as
  shown in the quickstart. A parent must exist before Task admission.
- Return an existing or desired attachment. Use a stable domain key when several
  inputs concern the same outcome; use the admitted request ID for distinct work.
- State an observable outcome and acceptance proof. A generic input kind alone
  is not a safe identity for all work of that kind.

A Task may converge in one attempt or continue through exact waits. May can
also finish self-contained authorized work in a bounded conversational turn;
see [Message Lifecycle](../2a-design/message-lifecycle.md).

## Add only the capabilities needed

| Need | Declaration or convention |
| --- | --- |
| Translate selected facts to input | `subscriptions` and pure `toInput` |
| Resolve desired work directly from a fact | `tasks.subscriptions` and pure `tasks.resolve` |
| Retain observation without work | `observations`, or a resolver returning `null` |
| Admit input or publish a fact on a cadence | `schedules` |
| Collect external facts | Bounded `observers` |
| Expose a typed command | `actions` with schema and pure `toInput` |
| Preserve a repeatable process | `agents/<agent>/workflows/<name>.ts` |
| Wait for another App | Typed dependency in the Task result |

Pure declarations and mappings do not perform domain effects. Execution occurs
in a bounded turn or Task attempt. Use the
[canonical package layout](../2a-design/agent-app.md#package-layout), rather
than adding an App daemon, queue, workflow registry, or state writer.

## Verify the actual routes

Run the package's declared checks; script names vary between Apps. Cover the
routes the App uses, including repeated input, Task attachment, result admission,
exact waits, dependencies, and failed definitions. Use portable fixtures rather
than a live installation for these checks.

Before rollout, verify the paired Host/SDK release and use the documented
[activation and recovery procedure](app-operations-recovery.md). Prove restart
identity and adapter presentation where the App depends on them. A passing
unit test or definition import alone does not prove deployment behavior.
