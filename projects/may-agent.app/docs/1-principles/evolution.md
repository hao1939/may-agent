# Agent Evolution

**Design status:** Draft promotion heuristic.

Evolution is evidence-backed improvement of an owner's behavior. It is not one
linear ladder from lesson to handler. Two independent decisions are involved:

1. How should knowledge be encoded?
2. Which runtime mechanism, if any, should execute or enforce it?

Operational contracts remain authoritative in `skills.md`, `workflows.md`,
`guards.md`, `agent-convention.md`, and the SDK/manual documentation.

## Knowledge Encoding

Knowledge becomes stronger only when evidence justifies a more durable form:

```text
experience -> lesson/context -> skill
```

| Form | Use when | Location |
| --- | --- | --- |
| Experience | One session discovered something; durability is not yet justified | Session evidence |
| Context/fact | Environment-specific truth should be available later | `context.md` or owned knowledge |
| Lesson | A repeated mistake or useful rule should be reviewed for promotion | `LESSONS.md` or owned knowledge |
| Skill | A reusable judgment-heavy method has stable triggers and useful guidance | Scoped `skills/<name>/SKILL.md` package |

Frequency alone does not justify automation. A recurring judgment-heavy method
may remain a skill used by scheduled sessions.

## Runtime Mechanisms

Runtime mechanisms are selected by control need, not maturity level:

| Need | Mechanism | Controller |
| --- | --- | --- |
| One bounded judgment/action | Agent session | Model |
| Situational method for one turn | Skill | Model |
| Repeatable ordered sequence, branch, retry, or verification | Workflow | TypeScript workflow runtime |
| Mechanically detectable risk around execution | Guard | Guard hook/runtime |
| New action or external integration | Tool | Tool implementation |
| Timer/event bridge or mechanical projection | Handler/app schedule | Runtime callback |
| Durable multi-session goal and state | Project app | Project owner through events/workflows |
| Cross-owner blocker | Escalation | Receiving owner |

These mechanisms compose. They do not supersede one another. A handler may
start a workflow; a workflow may call an agent with a skill; a guard may observe
the workflow; a tool may supply a deterministic capability.

## Promotion Tests

Before strengthening an encoding or mechanism, answer:

1. What repeated evidence shows the current form fails?
2. Is the failure about missing knowledge, variable judgment, sequence,
   mechanical detection, missing capability, triggering, or durable ownership?
3. What is the smallest mechanism that addresses that cause?
4. What evidence will show the change helped?
5. How can the mechanism be retired if it adds noise or cost?

Do not respond to every mistake by adding prompt text, a guard, or another
workflow. Debug what the model actually received first.

## Skills

A skill is scoped reusable guidance, loaded only for a matching turn.

```text
<scope>/skills/verify-change/
  SKILL.md
  references/       # optional
  scripts/          # optional JS/TS helpers
  assets/            # optional
```

The model remains the controller. A bundled script runs through normal tools
and permissions; it does not give the skill a workflow lifecycle.

Promote a method to a skill when:

- its trigger conditions are recognizable;
- context determines how the method should be applied;
- loading it permanently would waste context;
- repeated use shows the guidance is useful.

## Workflows

A workflow is TypeScript-controlled ordered execution. Promote a practice to a
workflow when evidence shows that missing, reordering, or inconsistently
handling steps creates meaningful risk and the sequence has explicit inputs,
outputs, bounds, and terminal conditions.

```ts
export const name = "implement-and-verify";
export const description = "Implement one bounded change and verify it.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const implementation = await ctx.runAgent("dev", ctx.task);
  if (implementation.status === "error") {
    return ctx.blocked("Implementation failed", {
      sessionId: implementation.sessionId,
    });
  }
  const verification = await ctx.runFunction("verify", async () => {
    const { execSync } = await import("node:child_process");
    return execSync("bun test", { encoding: "utf8" });
  });
  if (verification.status === "error") {
    return ctx.blocked("Verification failed");
  }
  return ctx.done("Implemented and verified");
}
```

Workflows are synchronous ordered blocks. Durable waits cross an event boundary
into a later workflow run.

## Guards

A guard observes mechanically identifiable execution risk. Start with
observation or warning. Hard blocking requires high-confidence detection and
high impact.

Use a guard when:

- the signal is mechanically detectable from tool/workflow context;
- the intervention point is clear;
- false positives are measurable;
- the same risk occurs across enough work to justify shared enforcement.

Do not use a guard to encode subjective quality, project strategy, or an
owner's acceptance judgment.

Every intervention should emit observable `guard.triggered` evidence with the
session/workflow/step context needed for later evaluation.

## Tools

A tool supplies an action the agent otherwise cannot take cleanly. Prefer an
existing preset or SDK capability before creating a local tool.

Canonical tool presets are defined by `agent.json` and the runtime loader; the
manual is the human reference. Important examples include:

- `coding` for read/write/edit/bash;
- `agents` for call/fork/list/peek/cancel;
- `message` for durable notifications;
- `workflow` for list/run/resume;
- `cli-delegation` for durable `run_cli_agent` tasks;
- `system-status`, `cron`, `checkpoint`, `scrape`, and `finish` where needed.

Local domain tools live under the owning global or app-local agent's `tools/`
directory. Discovery of a file is not proof of a supported contract; verify the
tool appears in the actual runtime tool list.

## Handlers And Schedules

Handlers and schedules answer “when should existing behavior run?” They are not
the highest level of learned knowledge.

Use them for:

- timer/event-to-workflow bridging;
- bounded normalization and preflight;
- metric snapshots and projections;
- recovery/reconciliation mechanics;
- explicit skip/no-op decisions.

Project-specific triggers belong in `projects/<id>.app/app.ts`. Standalone
agent triggers belong in the agent's runtime declaration. Keep judgment and
multi-step orchestration in the owning workflow/agent.

## Projects

Create or extend a project app when the improvement is a durable goal requiring
ownership, state, decomposition, multiple executions, and later validation.
Do not create a project merely because a timer repeats.

A project can own a skill experiment, workflow rollout, guard calibration,
tool integration, or handler migration. The project remains the durable goal;
the mechanism remains an implementation choice.

## Escalation

Escalate only when the next required action crosses an ownership boundary and
cannot be resolved locally.

```ts
// Workflow: local terminal blocker; caller/runtime decides routing.
return ctx.blocked("Approval is required", { evidence });

// Handler/agent SDK: explicit external ownership handoff.
sdk.escalate("Production decision required", {
  owner: "human:operator",
  requestedAction: "Approve, adjust, or reject the rollout.",
  evidence,
});
```

Ordinary local retries, weak evidence, and unclear thinking are not external
escalations. Preserve the blocker, requested action, evidence, source context,
resume path, and a stable deduplication key.

## Examples

| Observation | Smallest justified response |
| --- | --- |
| One agent forgot a command once | Record evidence; do not build yet |
| Environment path repeatedly surprises one owner | Add owned context/knowledge |
| A judgment method is useful across varied tasks | Add a scoped skill |
| Implement-then-verify ordering repeatedly fails | Add a workflow |
| High-confidence secret pattern appears in writes | Add an observable guard, then validate blocking |
| Required API/action does not exist | Add or extend a tool/SDK capability |
| Existing workflow should run daily | Add an app schedule/handler bridge |
| Improvement needs rollout, calibration, and later outcome review | Track it as project work |

## Retirement

Evolution also removes mechanisms. Retire or simplify when evidence shows:

- a lesson became stale;
- a skill is never selected or does not improve outcomes;
- a workflow adds ceremony without reducing failure;
- a guard is noisy or duplicates another check;
- a tool duplicates the SDK/runtime;
- a handler has no live trigger or owner;
- a project no longer needs an ownership loop.

Deletion and consolidation are successful evolution when they restore a clear
boundary.
