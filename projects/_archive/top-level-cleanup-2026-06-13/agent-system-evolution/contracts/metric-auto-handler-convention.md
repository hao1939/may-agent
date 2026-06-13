# Metric Auto-Handler Convention

Status: **active**
Promoted: 2026-05-22
Origin: `metric-auto-handler-pattern` experiment (agent-system-evolution)

## Purpose

Deterministic metric remediations should bypass LLM triage and execute directly,
reducing cost, latency, and false-negative risk. This convention defines how to
register, structure, and govern such auto-handlers.

## When to Use

A metric qualifies for an auto-handler when **all** of these hold:

1. The breach condition is unambiguous (single threshold comparison).
2. The remediation is deterministic and idempotent.
3. The action has bounded blast radius (e.g., closes at most N sessions).
4. The metric has fired ≥5 times historically with the same manual fix.

## Handler Shape

```typescript
interface MetricAutoHandler {
  metricId: string;
  description: string;
  trigger: { op: ">" | "<"; threshold: number };
  cooldownMs: number;           // minimum ms between invocations
  priorities?: string[];        // only fire for these alert priorities
  maxActions?: number;          // cap per invocation (default: 10)
  action: (ctx: HandlerContext, currentValue: number) => Promise<void>;
}
```

## Registration

Auto-handlers are registered in a typed array (`AUTO_HANDLER_REGISTRY`) inside
the handler module closest to their domain:

- Session/evaluator metrics → `agents/may/handlers/metric-auto-handlers.ts`
- Project metrics → routed via `metric-alert-reactor` with `route: "project"`

The `metric-alert-reactor` checks the registry **before** dispatching an LLM
triage workflow. If a handler matches and cooldown has elapsed, it runs the
action and emits `handler.skipped` (suppressing triage) or `metric.auto_handled`.

## Governance Rules

| Rule | Rationale |
|------|-----------|
| Every handler must emit an event on execution | Audit trail for watch tasks |
| Cooldown ≥ 5 minutes | Prevent runaway loops |
| `maxActions` ≤ 10 per invocation | Bound blast radius |
| Handler code must be idempotent | Safe to re-fire after crash/restart |
| New handlers require a 48h watch period | Catch false-fires before promotion |

## Observability

- `handler.skipped` events record every suppressed triage dispatch.
- `metric.auto_handled` events record actual remediation actions.
- The `metric-alert-reactor` logs handler match/miss for debugging.

## Validation Evidence

Initial PoC ran for ~19.5h with:
- 188 `handler.skipped` events (project metric routing)
- 108 stale-session specific skips
- 0 false-fires (no handler.skipped without a corresponding breach)
- 4/5 stale-session alerts auto-resolved within one reactor cycle (~5 min)

## Promotion Path for New Handlers

1. Implement handler in `AUTO_HANDLER_REGISTRY` with conservative cooldown.
2. Deploy; monitor `handler.skipped` / `metric.auto_handled` events for 48h.
3. If no false-fires or missed triggers, mark handler as `stable`.
4. If blast radius exceeded or false-fires occur, disable handler and file a
   finding.

## References

- Spec: `projects/agent-system-evolution/outputs/metric-auto-handler-spec.md`
- PoC code: `agents/may/handlers/metric-auto-handlers.ts`
- Integration: `agents/may/handlers/metric-alert-reactor.ts`
