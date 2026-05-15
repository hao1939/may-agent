# DESIGN: Sensor-Judge Cron Migration

**Author:** May  
**Status:** COMPLETE — 2 of 4 handlers migrated to sensor-judge workflows (2026-04-14). Remaining 2 are not migration candidates.  
**Date:** 2026-04-14  
**Related but separate:** [Workflow Guards](workflow-guards.md) — the reactive demand system for workflow quality enforcement

---

## What This Is (And What It Isn't)

This is about **converting specific cron handlers into workflows** using the sensor-judge pattern.

**This is NOT about guards.** Guards are a quality enforcement layer (warn/block/inject steps). Sensor-judge is an **execution pattern** — JS collects data (sensor), LLM makes decisions (judge). They're orthogonal:

- A sensor-judge workflow gets guard protection for free (because it's a workflow)
- But the primary value is **atomic context** — the LLM judge sees fresh data, not stale files

| | Guards (separate doc) | Sensor-Judge (this doc) |
|---|---|---|
| **Problem** | Quality enforcement across workflow steps | Stale context between data collection and LLM decisions |
| **Mechanism** | Event listeners that react with demands | Two-step workflow: JS function → LLM agent |
| **Applies to** | All workflows automatically | Specific cron handlers that already use LLM |
| **Cost impact** | Small overhead (injected test/verify steps) | Net zero (replaces existing LLM calls, not adding new) |

---

## The Problem: Disconnected Cron Handlers

Today, several cron handlers follow this pattern:

```
[cron fires] → JS collects data → writes report.md → [gap] → [later] agent reads stale report
```

Or:

```
[cron fires] → JS collects data → spawns loose LLM session via manager.run()
```

Both have the same issue: **the LLM doesn't see the data in-context**. It either reads a stale file or gets a summarized prompt that loses detail.

---

## The Solution: `runFunction()` + `runAgent()` in One Workflow

The workflow engine already supports `ctx.runFunction()` (zero-LLM JS execution) and `ctx.runAgent()` (LLM session). Combining them in one workflow gives us:

```
[cron fires] → workflow:
  Step 1: ctx.runFunction("scan-errors", scanLogsFn)  → structured data (zero LLM cost)
  Step 2: ctx.runAgent("coach", dataInContext)         → LLM decides + acts (sees fresh data)
```

The LLM judge in step 2 sees the raw scan output as a completed step, not a stale file. Context is atomic and fresh.

### Short-circuit: No Data = No LLM

If step 1 finds nothing interesting, the workflow ends immediately — zero LLM cost:

```typescript
export async function execute(ctx: WorkflowContext) {
  const scan = await ctx.runFunction("scan-errors", async () => {
    return JSON.stringify(scanErrorLogs());
  });
  
  const patterns = JSON.parse(scan.lastAssistantText ?? "[]");
  if (patterns.length === 0) {
    return ctx.done("No patterns found.");  // Zero LLM cost
  }
  
  const analysis = await ctx.runAgent("coach",
    `Analyze these error patterns and suggest fixes:\n${scan.lastAssistantText}`
  );
  return ctx.done(analysis.lastAssistantText ?? "done");
}
```

---

## Migration Tiers

Not all handlers benefit. We use three tiers:

### Tier 1 — Stay as JS handlers (no change)

Pure computation: deterministic, numeric, no judgment required. LLM adds cost with no value.

| Handler | Why it stays JS |
|---------|----------------|
| `analyze-failures` | Intentionally de-LLM'd (saved 78 ops/week). Math, not judgment. |
| `daily-brief` / `daily-digest` | Metrics aggregation. No decisions to make. |
| `coaching-report` | Score computation. Threshold-based. |
| `system-status` | Health check math. Numeric alert thresholds. |
| `tool-quality-scan` | Pattern matching + aggregation. |
| `health-trend` | Week-over-week comparison. Numeric thresholds. |
| `lessons-graduation` | Rule-based promotion logic. |
| All infrastructure handlers | watchdog, zombie-cleanup, audit-requests, memory-trimmer, workspace-compaction, agents-auto-commit, session-sync, evaluation-sync, research-sync |

**Criteria:** Output is deterministic. No LLM judgment needed. No existing LLM cost.

### Tier 2 — Convert to sensor-judge workflows (4 handlers)

These **already incur LLM cost** (via spawned sessions or agent messages). Converting makes the existing cost more efficient.

| Handler | Current Pattern | Workflow Benefit |
|---------|----------------|-----------------|
| `error-log-scanner` | JS scans → spawns coach via request | Atomic: scan + coach in one workflow. Fresh context. |
| `coaching-feedback` | JS groups violations → sends to coach | Coach sees raw data in-context, not stale file. |
| `priority-drift` | Already spawns LLM session | Formalizing as workflow adds guard protection. |
| `active-nudge` | JS checks staleness → may trigger action | Judge step makes smarter decisions than thresholds. |

**Cost impact:** Net zero. Replaces existing LLM calls, doesn't add new ones.

### Tier 3 — Future: Heartbeat workflow (deferred)

Heartbeat migration is Phase 4+, only after sensor-judge is proven stable for ≥2 weeks.

---

## Implementation Plan

### Step 1: Cron `"workflow"` entry type ✅ DONE

The existing `run-workflow` handler already supports dispatching workflows from cron. Added `runFunction()` and `agent` to its WorkflowContext so sensor-judge workflows work.

**Actual implementation:** Uses `handler: "run-workflow"` with `handlerConfig.workflow` in cron.json (no new cron entry type needed — the existing handler mechanism works).

### Step 2: Migrate error-log-scanner (first candidate) ❌ REMOVED

> **Note (2026-04-19):** `error-scan.ts` was removed from disk. The workflow file no longer exists.

**Former file:** `agents/shared/workflows/error-scan.ts` (447 lines)

Workflow pattern:
1. `runFunction("scan-error-logs")` — scans all ERROR_LOG.jsonl files (zero LLM cost)
2. Short-circuit: if no patterns above threshold → `ctx.done()` (zero LLM cost)
3. `runAgent("coach", judgeTask)` — LLM judge analyzes patterns with full context (LLM cost only when needed)
4. `runFunction("update-cooldowns")` — persists trigger cooldowns

**Cron entry:** Old `error-log-scanner` disabled, new `error-scan` entry uses `run-workflow` handler pointing to the workflow.

### Step 3: Migrate remaining Tier 2 handlers

One at a time, validate each:
- ❌ `coaching-feedback` → `agents/shared/workflows/coaching-feedback.ts` — **REMOVED from disk (2026-04-19).** Workflow file no longer exists.
- `priority-drift` → NOT IN CRON (dead code handler file). Skip unless re-activated.
- `active-nudge` → Pure JS intervention (cancel/nudge). Not a sensor-judge candidate (no LLM needed).

### Step 4: Validate

For each migrated handler, verify:
- Same functionality (catches same issues)
- Same or lower LLM cost (short-circuit when no data)
- Better context quality (judge sees fresh data)
- Guards fire correctly on any code changes

---

## How Guards Fit In (Passively)

Because sensor-judge handlers become workflows, they automatically get guard protection. But this is a **free side-effect**, not the goal:

```
error-scan workflow runs:
  → runFunction("scan-errors") → step_done event → guards check → no code changes → no demands
  → runAgent("coach", analysis) → step_done event → guards check → if code changed, auto-test fires
```

The guard system doesn't care whether a workflow is a converted cron handler or a manually-invoked workflow. It just reacts to events.

---

## Files

| File | Purpose |
|------|---------|
| `src/app/cron.ts` | New `"workflow"` entry type |
| `agents/shared/workflows/error-scan.ts` | ❌ Removed from disk |
| `agents/shared/workflows/coaching-feedback.ts` | ❌ Removed from disk |
| `agents/shared/workflows/priority-drift.ts` | Third migration |
| `agents/shared/workflows/active-nudge.ts` | Fourth migration |
