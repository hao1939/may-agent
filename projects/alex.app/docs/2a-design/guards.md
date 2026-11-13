# Guards As Signals

**Supports:** [System Model](system-model.md#improve-from-evidence-and-make-problems-actionable). Makes mechanically detectable execution risks observable without treating a signal as semantic judgment.

**Choice basis:** [Choosing the Right Mechanism](../1-principles/code-vs-data.md#why-not-default-to-prompt-rules-or-blocking-guards).

**Design status:** Accepted.
**Implementation status:** Implemented; the runtime and public SDK recognize
`observe`, `warn`, and `block` (hidden `run_step` / `repair` step injection was
retired after `EXP-216` in favor of explicit workflow TypeScript repair loops).
The three Host path/read heuristics were retired in
[Host PR 470](https://github.com/hao1939/may-agent/pull/470), merged as
`c5b9b9a70f47`, and the remaining unused `extractHallucinatedRelPath` helper
and legacy `memory-sanitizer.ts` file-write regex filter were retired in
[Host PR 479](https://github.com/hao1939/may-agent/pull/479), merged as
`9149a60268`; see [the selected reduction](../proposals/external-components-simplification.md#retire-host-path-and-read-heuristics).
The remaining default finish/commit diagnostics and their tool-guard
composition were retired in
[Host PR 471](https://github.com/hao1939/may-agent/pull/471), merged as
`e5f373cc459d`; see
[the completion reduction](../proposals/external-components-simplification.md#retire-default-tool-completion-diagnostics).
Source removal is complete; installed adoption remains unverified.

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

Historical usefulness does not make a detector permanent. Retire a detector
when its assumptions no longer fit the supported execution contract or its
signals add little value compared with the state and exceptions it requires.
Do not replace it with a more elaborate detector merely to preserve coverage.

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
| `block` | Stop the action/session/workflow and emit event. | High-confidence, high-impact risk. |

Use `block` sparingly. Good blocking cases include secret leakage, destructive
commands, cross-owner writes without permission, committing unrelated work,
irreversible DB/filesystem mutation, or a known violation with high confidence
and high cost.

Escalation is not a guard demand. After a guard exposes a blocker, the owning
runtime/agent may create an explicit escalation only when the next required
action crosses an ownership boundary.

App-authored guards use the canonical `@may-agent/sdk` demand vocabulary.
Do not bypass the type contract with casts or introduce a second guard-action
model.

## Default Observation Path

Following convention over configuration, every guard should get default
observability without each guard author wiring a custom event handler.

Default path:

```text
guard fires
  -> emit guard.triggered
  -> event/evidence projection accepts the diagnostic fact
  -> optional intervention happens in guard runtime
  -> metrics snapshot and evaluator/owner review can inspect patterns later
```

The guard runtime detects and intervenes. Persistence and read projections make
the signal observable; no dedicated work item or handler run is created for
each trigger. Agents, evaluator, and owners judge and improve the system.

## Standard Event

```ts
type GuardTriggeredData = {
  guard: string;
  demandType: "observe" | "warn" | "block";
  action: "observed" | "warned" | "blocked";
  sessionId?: string;
  workflowRunId?: string;
  projectId?: string;
  parentSessionId?: string;
  step?: string;
  reason: string;
  sourceEventType: string;
};

type GuardTriggeredEvent = {
  type: "guard.triggered";
  // "tool" remains accepted for retained historical evidence.
  source: "workflow" | "tool";
  owner: string;
  data: GuardTriggeredData;
};
```

Target invariant: every guard trigger emits `guard.triggered`.

## Architecture

App-authored workflow guards emit `guard.triggered` events. Concrete tool
contracts are enforced by their capability boundaries rather than a default
Host diagnostic layer. Historical tool guard events remain readable.

### Workflow Guards

Workflow guards are App/shared modules exporting `guard: WorkflowGuard`.
`loadGuards()` in Host `src/lib/workflow-tool.ts` discovers the supplied guard
directories. The hosted runner dispatches `workflow_start`, agent `step_done`,
and `workflow_done` callbacks. The SDK still declares `step_start`, but the
current runner does not dispatch it. Its `workflow.step_started` presentation
callback is separate, as are App events published through `ctx.events.emit()`.
Direct workflow and SDK test runners do not discover shared guard modules.

Each guard exports `guard: WorkflowGuard` with a `handle()` method. The guard
returns demands from the supported SDK vocabulary. The SDK step callback type
admits `source: "agent"` or `"function"`; current hosted step callbacks identify
agent results. Emitted `guard.triggered` diagnostics use
`source: "workflow"` and the guard's own name in the `guard` field.

Standard callbacks carry no repository-root or write-ownership fields. The shared
`finish-guard` inspects the supplied task and result for its workflow-selection
rule; its dormant Git-warning fallback is retired. When acceptance requires a
repository-state check, the owning workflow checks its actual workspace rather
than inferring edit ownership from paths and shell text in a guard. This adds no
automatic commit requirement or replacement detector.

Workflow guards can inspect completed-step evidence for expectations such as
build confirmation or secret leakage. The dormant shared read/verify primers
and milestone scorer are retired: they depended on the undispatched
`step_start` callback, and the scorer also required a retired worker process.
Required verification and acceptance criteria remain explicit in the owning
workflow. Historical experiment results do not establish current activation.

### Tool Contracts And Completion

The selected Host contract has no default tool-guard composition or diagnostic
callback. Path/read heuristics, finish write-activity guessing and automatic Git
scans at completion are retired. No replacement detector or toggle is required.
This gives up automatic tool diagnostic signals; App workflow guards retain
their separate SDK/runtime path and may enforce explicit App expectations.

Required-result checks, tool argument validation and file-write permissions
remain at their concrete capability boundaries. A success report claiming a
missing deliverable is rejected by the finish tool. Invalid result/schema or
caller admission stays correctable before completion. An accepted finish ends
the invocation and fences later tool calls from the same batch; the existing
Pi `beforeToolCall` fence remains for this exact authority check.

The Host does not require a Git commit or infer successful work from a tool
name. Apps judge their acceptance criteria, including verified/committed source
when required. Execution cancellation and read/Bash output limits bound
resource use. Output truncation limits one response, not the number of wasteful
calls. File errors and saved tool evidence remain available to the agent and App.

Historical tool diagnostics used `demandType: "warn"` and `action: "warned"`,
but their `block: false` reason was not injected into model context. That label
alone is not proof of an intervention. Retained tool rows and their event schema
remain available; workflow `warn` demands can inject context.

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
- Use structured detector identities when reviewing current workflow signals;
  reason-prefix parsing is only a fallback for historical tool rows.

## Ownership

Diagnostic attribution may use the following fallback order. It identifies
who should review evidence; it does not dispatch work or create a Task.
Actionable follow-up still requires an explicit App route or exact Condition.

Attribution order:

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
