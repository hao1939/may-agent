# Guard Registry

Guards are loaded from this directory by the workflow engine.
Each guard file must export a `guard` object matching the `WorkflowGuard` interface.

## Available Guards

| Guard | File | Description |
|-------|------|-------------|
| build-check | build-check.ts | Warns if coding steps don't confirm build/test success |
| auto-test | auto-test.ts | Injects a test step when src/ files are modified without test confirmation |
| pivot-detector | pivot-detector.ts | Detects create-test-fail-pivot loops; warns at 3 cycles, injects reassessment at 5 |

## Writing Guards

```ts
/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const guard: WorkflowGuard = {
  name: "my-guard",
  events: ["step_done"],  // optional: filter events
  handle(event: WorkflowGuardEvent): Demand[] {
    // Return [] for no objection
    // Return [{ type: "warn", reason: "..." }] to log a warning
    // Return [{ type: "block", reason: "..." }] to stop the workflow
    // Return [{ type: "run_step", reason: "...", step: { agent: "...", task: "..." } }] to inject a step
    return [];
  },
};
```

## Demand Types

- **warn**: Logs a warning but allows the workflow to continue.
- **block**: Stops the workflow immediately with a `WorkflowBlocked` error.
- **run_step**: Injects an additional agent step into the workflow (max 5 per run).
