# Guard Registry

Guards are loaded from this directory by the workflow engine.
Each guard file must export a `guard` object matching the `WorkflowGuard` interface.

## Available Guards

| Guard | File | Description |
|-------|------|-------------|
| build-check | build-check.ts | Warns if coding steps don't confirm build/test success |
| auto-test | auto-test.ts | Warns when src/ files are modified without test confirmation (safety net for workflows lacking their own verify step) |
| pivot-detector | pivot-detector.ts | Detects create-test-fail-pivot loops; warns at 3 cycles, injects reassessment at 5 |
| no-secret-leak | no-secret-leak.ts | Blocks workflow if step output contains API key/secret patterns (OpenAI, Anthropic, AWS, GitHub, Stripe, private keys); warns on medium-confidence patterns (Bearer tokens, generic key assignments) |
| cost-limit | cost-limit.ts | Tracks cumulative agent turns across workflow steps; warns at 40 total turns, blocks at 60 |
| finish-guard | finish-guard.ts | FM-3.4: Blocks finish(success) when persistent-task workflow was required but not invoked (EXP-188: +100pp) |

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

## Hard Gate Design Rules (KE-182)

Before designing or modifying guards that act as hard gates (blocking or injecting steps), apply these evidence-based rules:

1. **Gate artifact must BE the solution** — not describe the problem. Analysis-only gates cause "completion illusion" (-80pp regression, KE-180).
2. **Only gate low baselines (≤50%)** — on high baselines, gates add overhead or regress performance.
3. **Match step-skipping failure modes** — gates fix "rush to action" failures, not belief errors or competence gaps.
4. **Prefer 2-phase investigate→fix** — Phase 1 writes findings, Phase 2 reads them and acts. This is the strongest pattern (+90pp).
5. **All gates must be relevant** — unrelated gates dilute attention (92% vs 50% for related vs unrelated at same count).
6. **Max 3 related gates** — performance degrades at 4+ gates regardless of relevance.
7. **Measure product quality** — "Did the fix work?" not "Did the agent write ARTIFACT.md?" (KE-181).

Full details: `agents/shared/knowledge/entries/KE-182-hard-gate-design-rules-synthesis.md`
