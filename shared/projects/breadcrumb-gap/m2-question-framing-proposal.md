# M2: Question-Framing in Heartbeat Step 1

## Proposal

Based on KE-215 findings: inserting a **reasoning question as step 1** of the heartbeat workflow forces agents into evaluation mode before they encounter the dispatch board. This raises metric reaction from ~80% (breadcrumbs alone) to ~100%.

## The Problem

Current heartbeat step ordering:
```
1. Read dispatch board
2. Check metrics
3. Pick work
```
Agents enter "task-execution mode" at step 1, process the dispatch board, and by the time they reach metrics they're already committed to a dispatch item. Breadcrumbs help (80%) but don't fully solve the ordering problem.

## The Fix

Change step 1 to a **reasoning question** that forces metric evaluation:

### Before (current)
```markdown
## Your steps this cycle
1. Read the dispatch board items above.
2. Check your metrics for anything needing attention.
3. Pick ONE item and produce a write-up in triage-note.md.
```

### After (proposed)
```markdown
## ⚡ FIRST — evaluate your metrics before anything else

<metrics block with breadcrumbs>

**Question**: Which metric above is furthest from its target? If any metric has a "→ Quick check" hint, follow it NOW — run the command, read the file, or execute the query. Then decide: is this urgent enough to act on this heartbeat, or can it wait?

Only after evaluating your metrics, proceed to the steps below.

---

## Your steps this cycle
1. Answer the metric question above (you should have already investigated).
2. Read the dispatch board items.
3. Pick ONE item (or a metric-driven action) and produce a write-up.
```

## Implementation Location

The change goes in `agents/shared/workflows/agent-heartbeat.ts`, specifically in the `buildAgentHeartbeat()` function that assembles the heartbeat task text. The metrics block (from `loadMetricsBlock()`) should be wrapped with the question-framing template.

### Pseudocode patch
```typescript
// In buildAgentHeartbeat(), after loading metrics:
const metricsBlock = await loadMetricsBlock(agentName);
const hasAlerts = metricsBlock.includes('⚠️');

let step1;
if (hasAlerts) {
  step1 = `## ⚡ FIRST — evaluate your metrics before anything else\n\n` +
    metricsBlock + `\n\n` +
    `**Question**: Which metric above is furthest from its target? ` +
    `If any has a "→ Quick check" hint, follow it NOW. ` +
    `Then decide: act this heartbeat, or can it wait?\n\n` +
    `Only after evaluating your metrics, proceed below.\n\n---`;
} else {
  // No alerts — standard ordering, no question-framing overhead
  step1 = `## Your metrics (all healthy)\n\n` + metricsBlock;
}
```

### Key design decisions
1. **Only when alerts exist** — no cognitive overhead when metrics are healthy
2. **Question forces action** — "follow it NOW" is imperative, not suggestive
3. **Placed BEFORE dispatch board** — physical ordering matters; agents process top-to-bottom
4. **Preserves breadcrumbs** — the question complements breadcrumbs, doesn't replace them

## Evidence (KE-215)

| Variant | Step 1 | Breadcrumbs | Reaction Rate |
|---------|--------|-------------|--------------|
| Baseline | instruction | none | 0% (0/4) |
| Breadcrumb-only | instruction | yes | 80% (4/5) |
| G′ (question) | question | none | 100% (5/5) |
| G′+breadcrumb | question | yes | 100% (5/5) |

## Risk (KE-008)

Changing heartbeat structure carries risk of unintended side effects. Mitigations:
- **Conditional**: question-framing only activates when ⚠️ metrics exist (most heartbeats unaffected)
- **Gym-validated**: run `breadcrumb-reaction` vs `metric-reaction-G-breadcrumb` scenarios first
- **Rollback**: single function change, easy to revert
- **Staged**: deploy to 1 agent first (M4), measure before expanding

## Validation Plan
1. Run `breadcrumb-reaction` scenario 5x → confirm ~80% baseline
2. Run `metric-reaction-G-breadcrumb` scenario 5x → confirm ~100%
3. Deploy to coach agent only (lowest risk)
4. Measure `coach.breadcrumb-action-rate` for 1 week → target ≥0.8

## Status
**Draft** — ready for gym validation (M3) then staged rollout (M4).
