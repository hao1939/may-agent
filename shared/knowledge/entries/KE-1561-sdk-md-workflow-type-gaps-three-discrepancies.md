<ai_context>
The sdk.md design doc has three discrepancies with runtime code: (1) WorkflowResult is actually two distinct types—an internal {type:"done"|"escalate"} in workflow.ts and an external {status:"done"|"escalated"} in sdk.ts—but the doc shows only the external one while claiming WorkflowSDK.done() returns it; (2) WorkflowEscalationContext is defined in the doc but doesn't exist in code—actual signature is escalate(reason, context?: unknown); (3) done() accepts DoneOpts in sdk.ts but not in the WorkflowContext interface that workflows actually use.
Triggers: sdk.md, WorkflowResult, WorkflowEscalationContext, DoneOpts, workflow type, workflow escalate, design doc coherence, sdk design
</ai_context>

# KE-1561 — sdk.md WorkflowResult / Escalation / DoneOpts: Three Type Discrepancies with Runtime Code

**Date:** 2026-06-07
**Author:** arc (heartbeat coherence audit)
**Status:** confirmed — design doc staleness, not a runtime bug
**Confidence:** High — verified against `src/lib/sdk.ts`, `src/lib/workflow.ts`, `src/lib/workflow-defs.d.ts`, and `src/lib/sdk-impl.ts`
**Connects:** KE-1553 (events.md DDL fix), KE-1555 (events.md false-green claims), KE-1556 (metrics doc coverage gap), KE-1558 (sessions.error always NULL)

## Observation

The `shared/may-agent-docs/2a-design/sdk.md` design doc has three type-level
discrepancies with the actual runtime code. None are runtime bugs — the system
works correctly — but the doc gives agents and developers a misleading picture
of what WorkflowSDK methods accept and return.

## Discrepancy 1: WorkflowResult Is Actually Two Types

### What the design doc says
One `WorkflowResult` type:
```typescript
interface WorkflowResult {
  status: "done" | "escalated";
  summary: string;
  runId?: string;
}
```

### What the code actually has
**Two** distinct types that are mapped at the SDK boundary:

**Internal** (used by `workflow.ts`, `workflow-defs.d.ts`, and all `*.ts` workflow files):
```typescript
type WorkflowResult =
  | { type: "done"; summary: string }
  | { type: "escalate"; reason: string; context?: unknown };
```

**External** (used by `sdk.ts`, returned by `sdk.runWorkflow()`):
```typescript
interface WorkflowResult {
  status: "done" | "escalated";
  summary: string;
  runId?: string;
}
```

The bridge is in `sdk-impl.ts`:
```typescript
return {
  status: result.type === "done" ? "done" : "escalated",
  summary: result.type === "done" ? result.summary : result.reason ?? "escalated",
  runId
};
```

### Impact
The design doc shows `WorkflowSDK.done()` returning `WorkflowResult`, but
workflow code that calls `ctx.done("summary")` gets back the **internal**
`{type:"done", summary}`, not the external `{status:"done", summary, runId?}`.
An agent or developer reading sdk.md would expect `result.status` but should
use `result.type` inside a workflow file.

## Discrepancy 2: WorkflowEscalationContext Is a Phantom Type

### What the design doc says
```typescript
type WorkflowEscalationContext = {
  owner?: string;
  requestedAction?: string;
  evidence?: Record<string, unknown>;
  severity?: "P0" | "P1" | "P2" | "P3";
  [key: string]: unknown;
};
```
And `WorkflowSDK.escalate(reason: string, context?: WorkflowEscalationContext)`.

### What the code actually has
```typescript
// workflow.ts & workflow-defs.d.ts
escalate(reason: string, context?: unknown): WorkflowResult;
```

`WorkflowEscalationContext` does not exist in any source file.
`grep -rn "WorkflowEscalationContext" src/` returns zero results.

### Impact
Workflow authors who read sdk.md and structure their `context` argument with
`owner`, `severity`, etc. will not get an error — `unknown` accepts anything —
but the system doesn't inspect or route based on those fields either. The
design doc implies structured escalation metadata is consumed; it isn't.

## Discrepancy 3: done() Accepts DoneOpts in SDK but Not in WorkflowContext

### What the design doc says
```typescript
done(summary: string, opts?: { deliverables?, contextUpdates?, nextSteps? }): WorkflowResult;
```

### What the code actually has

In `sdk.ts`:
```typescript
done(summary: string, opts?: DoneOpts): WorkflowResult;
```
(DoneOpts has `deliverables`, `contextUpdates`, `nextSteps` — matching the doc)

In `workflow.ts` and `workflow-defs.d.ts` (what workflows actually call):
```typescript
done(summary: string): WorkflowResult;
```
No opts parameter.

### Impact
The external `WorkflowSDK.done()` interface supports DoneOpts, and `sdk-impl.ts`
implements it. But the primary `WorkflowContext` used by all workflow `.ts` files
does not accept opts. A workflow calling `ctx.done("summary", { deliverables: [...] })`
would get a TypeScript error if type-checked against `workflow-defs.d.ts`.

## Evidence

```bash
# Discrepancy 1: Two WorkflowResult types
grep -c "WorkflowResult" src/lib/sdk.ts      # 3 hits (external shape)
grep -c "WorkflowResult" src/lib/workflow.ts  # 5 hits (internal shape)
# sdk-impl.ts line ~30: maps type→status, reason→summary

# Discrepancy 2: Phantom type
grep -rn "WorkflowEscalationContext" src/  # 0 results

# Discrepancy 3: done() opts
sed -n '63p' src/lib/sdk.ts          # done(summary, opts?: DoneOpts)
grep "done(summary" src/lib/workflow.ts  # done(summary: string): WorkflowResult (no opts)
```

## Recommendation

Update `sdk.md` to document the duality:

1. **WorkflowResult** — note that workflow files see `{type:"done"|"escalate"}`
   while SDK consumers see `{status:"done"|"escalated", runId?}`. The mapping
   happens in `sdk-impl.ts`.

2. **WorkflowEscalationContext** — remove or mark as aspirational. The actual
   signature is `escalate(reason: string, context?: unknown)`.

3. **done() opts** — clarify that `DoneOpts` is available via the external
   `WorkflowSDK` interface (handlers using `sdk.runWorkflow` or
   `buildWorkflowSDK`) but not via the internal `WorkflowContext` passed to
   workflow `execute()` functions.

These are doc-only fixes (in-lane for arc under `shared/may-agent-docs/2a-design/`).

## Falsifier

After fix: `grep -c "WorkflowEscalationContext" shared/may-agent-docs/2a-design/sdk.md`
should return 0, and the doc should explicitly mention the internal/external
WorkflowResult distinction.
