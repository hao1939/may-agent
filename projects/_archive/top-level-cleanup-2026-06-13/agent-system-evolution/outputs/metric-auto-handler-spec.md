# Metric Auto-Handler Pattern

## Problem

Many metric breaches recur frequently and have well-known remediation actions.
Today, each breach triggers `metric-alert-reactor` → `metric-alert-triage`
workflow (an LLM session). This is expensive and slow for metrics whose fix is
deterministic. The top offenders by alert frequency:

| Metric | Alerts (all time) | Manual Action Today |
|--------|-------------------|---------------------|
| `evaluator.stale-running-session-count` | 15 | Kill sessions running >30min with no recent turns |
| `project.task-parser-error-count` | 12 | Run project format validator, emit fix event |
| `session.failed-triage-rate-3h` | 28 | Trigger evaluator aftermath backfill |

## Three Metrics Requiring Manual Triage → Auto-Handler Candidates

### 1. `evaluator.stale-running-session-count`

- **Current behavior**: Breach fires → LLM triage → owner told to check stale sessions.
- **Auto-handler action**: Query sessions running >30min, cancel them with a "stale auto-close" reason.
- **Threshold**: current > 0
- **Cooldown**: 10 minutes (sessions can become stale again quickly)
- **Stop condition**: Metric returns to 0

### 2. `project.task-parser-error-count`

- **Current behavior**: Breach fires → LLM triage → may investigates project.md files.
- **Auto-handler action**: Run `validateProjectFormat()` on all active project.md files, emit `project.format-fix-needed` event with the file paths and parse errors.
- **Threshold**: current > 0
- **Cooldown**: 30 minutes (format errors don't self-heal fast)
- **Stop condition**: Metric returns to 0

### 3. `session.failed-triage-rate-3h`

- **Current behavior**: Breach fires → LLM triage → evaluator told to backfill.
- **Auto-handler action**: Trigger `session-aftermath-scan` handler immediately (it already handles backfill).
- **Threshold**: current < 0.8
- **Cooldown**: 15 minutes (give the backfill time to run)
- **Stop condition**: Metric ≥ 0.8

## Handler Spec Shape

```typescript
interface MetricAutoHandler {
  /** Metric ID to match */
  metricId: string;
  /** Human-readable description */
  description: string;
  /** Breach condition (mirrors metric's alert_op + threshold) */
  trigger: {
    op: ">" | "<";
    threshold: number;
  };
  /** Minimum ms between handler invocations for this metric */
  cooldownMs: number;
  /** The remediation action — a function receiving handler context */
  action: (ctx: HandlerContext) => Promise<void>;
  /** Priority filter — only fire for metrics at these priorities */
  priorities?: string[];
}
```

## Architecture

```
metric.breach event
  → metric-alert-reactor (existing)
    → check auto-handler registry
      → if match + cooldown elapsed: run action directly, emit metric.auto_handled
      → if no match: proceed to LLM triage workflow as today
```

The auto-handler registry is a simple array of `MetricAutoHandler` entries
checked before the triage workflow dispatch. This keeps the existing system
intact while short-circuiting known-good automations.

## Proof of Concept

Implemented: `agents/may/handlers/metric-auto-handlers.ts`

Contains the registry and one working handler for `evaluator.stale-running-session-count`
that runs on the existing `metric-alert-reactor` timer (every 5 min) with a 10-minute
cooldown.

## Promotion Path

1. PoC validates the pattern works for stale-session reaping.
2. Add handlers for `project.task-parser-error-count` and `session.failed-triage-rate-3h`.
3. If all three reduce LLM triage sessions without regressions, propose:
   - Move registry into `metric-alert-reactor` as a pre-dispatch check.
   - Add `auto_handler` field to metric config in DB for declarative registration.
   - Emit `metric.auto_handled` events for audit trail.
