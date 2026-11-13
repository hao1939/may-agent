# Guard Registry

Guards are loaded from this directory by the Host workflow runner (`projects/may-agent/src/lib/workflow-tool.ts`).
Each guard file must export a `guard` object matching the `WorkflowGuard` interface.

## Loading

The Host workflow runner (`loadGuards` in `src/lib/workflow-tool.ts`) imports every `.ts` file in this
directory (skipping `.test.ts`, `REGISTRY*`, and `.disabled.ts`) and collects exports matching `{ guard: WorkflowGuard }`.

The hosted runner dispatches `workflow_start`, agent `step_done`, and
`workflow_done` guard callbacks. Although `step_start` remains declared in the
SDK, the current runner does not dispatch it. The presentation callback
`workflow.step_started` and App events published through `ctx.events.emit()` do
not invoke guards. Direct workflow and SDK test runners do not discover these
shared guards.

## Available Guards

| Guard | File | Description |
|-------|------|-------------|
| build-check | build-check.ts | Warns if coding steps don't confirm build/test success |
| auto-test | auto-test.ts | Warns when src/ files are modified without test confirmation (safety net for workflows lacking their own verify step) |
| no-secret-leak | no-secret-leak.ts | Blocks workflow if step output contains API key/secret patterns (OpenAI, Anthropic, AWS, GitHub, Stripe, private keys); warns on medium-confidence patterns (Bearer tokens, generic key assignments) |
| cost-limit | cost-limit.ts | Tracks cumulative agent turns across workflow steps; warns at 40 total turns, blocks at 60 |
| finish-guard | finish-guard.ts | FM-3.4: Blocks finish(success) when persistent-task workflow was required but not invoked (EXP-188: +100pp) |
| read-before-edit | read-before-edit.ts | C1.1: Warns when edit() is called on a file not read() in the same step (targets #1 violation type, 37% of baseline) |
| hallucinated-path | hallucinated-path.ts | C7.1: Warns when bash commands reference /home/, /Users/, /root/ paths that don't exist in the container environment |
| knowledge-entry-overwrite | knowledge-entry-overwrite.ts | Warns after whole-file writes or shell redirection to legacy low-numbered shared knowledge entries (KE-001..KE-999); new knowledge should use a fresh high-numbered KE id, and legacy updates should preserve existing content with read()+edit(). |

The dormant `milestone-quality`, `rbe-primer`, and `vae-primer` modules are
retired. They subscribed only to `step_start`; the milestone scorer additionally
required the retired `worker-iteration-1` process. Historical experiments remain
evidence about their original execution path, not current activation. Acceptance
criteria and required verification belong in the owning workflow.

`finish-guard` supplies workflow policy through its `guard` export. Required
finish arguments, caller result schemas and declared-deliverable checks remain
at the Host's finish-tool boundary; do not import a second validation API from
this directory. See the [tool completion contract](../../projects/alex.app/docs/2a-design/guards.md#tool-contracts-and-completion).
The guard reads the supplied callback without Git scans or inferred write
ownership. When repository-state verification is required, the owning workflow
checks its actual workspace and acceptance requirements.

## Writing Guards

```ts
import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

export const guard: WorkflowGuard = {
  name: "my-guard",
  events: ["step_done"],  // optional: filter events
  handle(event: WorkflowGuardEvent): Demand[] {
    // Return [] for no objection
    // Return [{ type: "observe", reason: "..." }] to record an observation only
    // Return [{ type: "warn", reason: "..." }] to log a warning for the next step
    // Return [{ type: "block", reason: "..." }] to stop the workflow
    return [];
  },
};
```

## Demand Types

- **observe**: Records `guard.triggered` without interrupting or modifying prompts.
- **warn**: Logs a warning and appends it to the next workflow agent step prompt.
- **block**: Stops the workflow immediately with a `WorkflowBlocked` error.
  (Multi-step repair belongs explicitly in workflow TypeScript; `run_step` injection is retired.)

## Hard Gate Design Rules (KE-182)

Before designing or modifying guards that act as hard gates (blocking or injecting steps), apply these evidence-based rules:

1. **Gate artifact must BE the solution** — not describe the problem. Analysis-only gates cause "completion illusion" (-80pp regression, KE-180).
2. **Only gate low baselines (≤50%)** — on high baselines, gates add overhead or regress performance.
3. **Match step-skipping failure modes** — gates fix "rush to action" failures, not belief errors or competence gaps.
4. **Prefer 2-phase investigate→fix** — Phase 1 writes findings, Phase 2 reads them and acts. This is the strongest pattern (+90pp).
5. **All gates must be relevant** — unrelated gates dilute attention (92% vs 50% for related vs unrelated at same count).
6. **Max 3 related gates** — performance degrades at 4+ gates regardless of relevance.
7. **Measure product quality** — "Did the fix work?" not "Did the agent write ARTIFACT.md?" (KE-181).

Full details: `shared/knowledge/entries/KE-182-hard-gate-design-rules-synthesis.md`
