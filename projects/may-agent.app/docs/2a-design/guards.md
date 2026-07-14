# Guards As Signals

**Design status:** Accepted.
**Implementation status:** Implemented for observe, warn, repair, and block; escalation remains an owner-boundary action.

Guards are detection signals first. Blocking is only one intervention mode.

Default meaning:

```text
mechanical detector fired -> emit unreviewed signal -> optional intervention -> later review
```

Not:

```text
regex matched -> proof the agent was wrong -> hard block
```

Every guard trigger should be observable. The important fact is that the
system detected a possible weakness, risk, missing context, misleading workflow
prompt, tool-surface confusion, or near-miss. A guard trigger is not solid
evidence by itself. It may be a true positive, false positive, noisy detector,
useful intervention, or harmful interruption.

Guard output enters the learning system as an unreviewed signal. The evaluator
or owner must compare the guard event with the raw session log, tool
request/output, project context, and final result before assigning blame or
changing behavior.

## Default Path

Default to metrics or evaluator review before adding a guard.

Use this progression unless the risk is high-impact and must be prevented
immediately:

```text
observe through metric/eval -> confirm repeated pattern -> improve workflow/tool/context -> add guard only if enforcement or near-action warning is still needed
```

A guard is justified when at least one condition holds:

- The mistake is high impact and should be prevented at the action boundary.
- The detector is precise, cheap, and has low false-positive risk.
- The signal will be reviewed and used to fix workflow, tooling, or context.
- Repeated incidents show the issue is systemic and softer feedback did not
  close it.

If the team hesitates, do not add a guard yet. Add a metric, evaluator check,
or review task first. Promote to an `observe` or `warn` guard only after the
signal proves useful. Promote to `block` only after the detector has strong
evidence and the cost of letting the action through is higher than the cost of
a false positive.

## Modes

| Mode | Behavior | Use when |
|---|---|---|
| `observe` | Emit a guard event only. Do not interrupt the agent. | Proven metric/eval signal that needs near-action visibility but should not affect work. |
| `warn` | Emit event and inject warning/context into the current session or next workflow step. | Likely issue but agent may self-correct. |
| `repair` | Emit event and inject/run a recovery step. | Mechanically recoverable issue such as missing verification. |
| `block` | Stop the action/session/workflow and emit event. | High-confidence, high-impact risk. |
| `escalate` | Stop or pause and route to owner/human. | Security, destructive action, repeated unresolved failure, unclear risk. |

Use `block` sparingly. Good blocking cases include secret leakage, destructive
commands, cross-owner writes without permission, committing unrelated work,
irreversible DB/filesystem mutation, or a known violation with high confidence
and high cost.

## Default Guard Handler

Following convention over configuration, every guard should get default
observability without each guard author wiring custom logging.

Default path:

```text
guard fires
  -> emit guard.triggered
  -> default guard handler records metrics/projection
  -> optional intervention happens in guard runtime
  -> evaluator/May/owner can review patterns later
```

The guard runtime detects and intervenes. The default handler observes and
measures. Agents, evaluator, and owners judge and improve the system.

## Standard Event

```ts
type GuardTriggeredEvent = {
  type: "guard.triggered";
  guard: string;
  demandType: "warn" | "block" | "run_step";
  action: "warned" | "blocked" | "injected" | "skipped_duplicate" | "skipped_invalid" | "skipped_limit";
  source: "workflow" | "tool";
  owner: string;
  sessionId?: string;
  workflowRunId?: string;
  projectId?: string;
  parentSessionId?: string;
  step?: string;
  reason: string;
  sourceEventType: string;
  injectedStepLabel?: string;
  injectedAgent?: string;
};
```

Target invariant: every guard trigger emits `guard.triggered`.

## Architecture

Guards operate at two levels, both emitting `guard.triggered` events.

### Workflow Guards

Workflow guards live under `shared/guards/*.ts` and are loaded by
`shared/guards/loader.ts`. They fire on workflow step transitions such as
`step_done` or `step_started`.

Each guard exports `guard: WorkflowGuard` with a `handle()` method. The guard
returns demands such as `warn`, `block`, or `run_step`. Events use
`source: "workflow"` and the guard's own name in the `guard` field.

Workflow guards are best for process-level expectations: read before edit,
verify after write, build after code changes, milestone quality, secret
leakage, or hallucinated paths in workflow evidence.

### Tool-Level Guards

Tool-level guards live under `projects/may-agent/src/lib/tools/*.ts`. They are
composed by `compose-guards.ts` and wired into the `beforeToolCall` hook in
`manager.ts`.

They fire on tool invocation, not workflow transitions. Use tool guards for
mechanical checks near the action boundary: empty arguments, schema misuse,
path hallucination, protected-file edits, session-log reads, repetitive reads,
and finish/commit evidence checks.

Tool-level guard events should identify the specific guard as structured data.
If many guards emit only `guard: "beforeToolCall"` and hide the real detector in
free-form `reason`, downstream metrics and review must parse text, which is a
schema smell to fix.

## Runtime Audit

Guard composition is operational data, not design state. It changes with active
agents, throughput, and project mix. A healthy audit looks for patterns rather
than preserving dated row-count snapshots in this design doc.

Use [guard-runtime-audit.md](../2b-manual/guard-runtime-audit.md) to inspect
current guard volume, composition, repeated per-session signals, and threshold
quality.

Stable lessons from prior incidents:

- Guard metrics must distinguish detector volume from reviewed correctness.
- Threshold increases are temporary relief when the signal has a structural
  noise floor; repeated breaches should produce a root-cause task.
- Per-session dedup is appropriate when one condition emits many repeated guard
  events from the same session.
- Dedup does not help one-event-per-session patterns; those need workflow,
  prompt, or tool-surface fixes.
- Tool-level guard names should be specific enough for metrics.

## Ownership

Default owner resolution:

1. explicit event owner,
2. project owner,
3. triggering agent,
4. guard id prefix if it matches an agent,
5. May fallback.

The owner is accountable for judgment, not automatically at fault.

## Review Outcome

When a guard signal is reviewed, record the judgment in the session eval trail
or a guard review artifact. Keep the raw guard event linked.

| Outcome | Meaning | Learning action |
|---|---|---|
| `true_positive` | The guard caught a real issue or near-miss. | Route normal owner finding if follow-up is needed. |
| `false_positive` | The guard fired on valid behavior. | Route to the guard/workflow owner to calibrate. |
| `noisy` | The signal is too weak or repetitive to act on directly. | Keep aggregate metric; avoid owner spam. |
| `useful_intervention` | The guard helped the agent recover. | Consider moving the lesson into workflow/context. |
| `harmful_intervention` | The guard blocked or distracted useful work. | Downgrade mode, narrow detector, or retire. |
| `unknown` | Not enough context to judge. | Preserve evidence; do not train from it yet. |

Only reviewed guard outcomes should become `learning.feedback`. Raw
`guard.triggered` rows and raw guard metrics can request review, but they
should not directly train agents or accuse owners.

## Metrics

Start small:

- `guard.triggered-count-24h`
- `guard.warned-count-24h`
- `guard.blocked-count-15m`
- `guard.repeat-trigger-count-24h`

Later metrics can be added only when necessary, for example
`guard.recovered-after-warning-rate` or `guard.false-positive-rate`.

When a metric is noisy or repeatedly breaches, review the current runtime
composition with [guard-runtime-audit.md](../2b-manual/guard-runtime-audit.md)
before changing thresholds.

## Review Questions

Most guard triggers should feed later review:

- Which guard fires most?
- Did the agent self-correct after a warning?
- Which workflow creates repeated guard warnings?
- Is the guard too strict?
- Is this a prompt/context weakness?
- Should this be a workflow step instead of a guard?

This keeps guards aligned with the event/metric model: a guard trigger is a
signal; agents/evaluator/May judge; metrics track trend; workflows repair the
process when evidence justifies it.
