# Guards As Signals

**Status**: Guard trigger event emission and first metrics slice implemented.

Guards are detection signals first. Blocking is only one intervention mode.

Default meaning:

```
mechanical detector fired -> emit event/signal -> optional intervention
```

Not:

```
regex matched -> hard block
```

Every guard trigger should be observable. The important event is that the
system detected a weakness, risk, missing context, misleading workflow prompt,
tool-surface confusion, or near-miss.

## Modes

| Mode | Behavior | Use when |
|---|---|---|
| `observe` | Emit a guard event only. Do not interrupt the agent. | New guard, uncertain detector, behavior research, false-positive risk. |
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

```
guard fires
  -> emit guard.triggered
  -> default guard handler records metrics/projection
  -> optional intervention happens in guard runtime
  -> evaluator/May/owner can review patterns later
```

The guard runtime detects and intervenes. The default handler observes and
measures. Agents/evaluator judge and improve the system.

## Standard Event

```ts
type GuardTriggeredEvent = {
  type: "guard.triggered";
  guard: string;
  demandType: "warn" | "block" | "run_step";
  action: "warned" | "blocked" | "injected" | "skipped_duplicate" | "skipped_invalid" | "skipped_limit";
  source: "workflow";
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

Current gap: tool-level guards and workflow-level guards should converge on the
same event shape when practical. Workflow guard triggers are already uniformly
queryable as events and metrics.

## Ownership

Default owner resolution:

1. explicit event owner,
2. project owner,
3. triggering agent,
4. guard id prefix if it matches an agent,
5. `may` fallback.

## Metrics

Start small:

- `guard.triggered-count-24h`
- `guard.warned-count-24h`
- `guard.blocked-count-15m`
- `guard.repeat-trigger-count-24h`

Later metrics can be added only when necessary, for example
`guard.recovered-after-warning-rate` or `guard.false-positive-rate`.

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
