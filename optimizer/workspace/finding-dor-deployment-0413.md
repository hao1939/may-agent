# D-o-R Lens Workflow — Deployment Notes

**Date**: 2026-04-13  
**Deployer**: Optimizer  
**Status**: Workflow deployed, heartbeat patch pending

---

## What Was Deployed

### 1. New Workflow: `agents/tech-lead/workflows/lens-analysis.ts`

A D-o-R phased Lens investigation workflow that:

- **Embeds phase boundaries in the child session's task string** — so the executing agent actually sees them (unlike passive heartbeat text that stays behind in the dispatcher)
- **Enforces deliverable verification** via JS file checks (no LLM cost) — catches missing/empty findings docs
- **Injects fix-creep guard** — explicit "do NOT fix inline" instruction travels with the session

**Phase budget structure:**
| Phase | Op Budget | Purpose |
|-------|:-:|---------|
| SCOPE | ≤3 | Read targets, state hypothesis |
| INVESTIGATE | ≤10 | Evidence gathering, no writing |
| WRITE | ≤5 | Produce findings deliverable |
| EXIT | 1 | finish() — no inline fixes |
| **Total** | **≤20** | Down from 24.2 avg (73.8 bloated) |

**Input format:**
```
Lens <X>: <target description>
deliverable: agents/tech-lead/workspace/<finding-name>.md
```

If `deliverable:` is omitted, auto-generates a slug from the task.

**Verification behavior:**
- Hard failure: deliverable file missing or empty → workflow escalates
- Soft warning: placeholder patterns detected → reported but not blocking
- Reports ops used and deliverable size in summary

### 2. Heartbeat Patch Required (PENDING)

The heartbeat (`agents/tech-lead/heartbeat.md`) needs three changes. Optimizer cannot edit identity files for other agents — **tech-lead or May must apply these**.

#### Change 1: Update workflow routing table (Step 3)

In the `### ⚡ Default: Use workflows for all forked work` section, update the table:

| Work type | Workflow | Why |
|-----------|----------|-----|
| **Lens investigation** | `workflow.run('lens-analysis', task)` | **Embeds D-o-R phases + verifies deliverable** |
| Any code change (refactor, delete, fix) | `workflow.run('implement-and-verify', task)` | Catches forgotten tsc/test — your #1 error source |
| Multiple independent questions | `workflow.run('parallel-research', JSON.stringify({...}))` | Parallel > sequential when questions are independent |

#### Change 2: Replace "Lens Phase Boundaries" + "Workflow routing" sections

**Remove** the entire `### 📐 Lens Phase Boundaries (D-o-R for Investigations)` section (from heading through "The #1 anti-pattern" note).

**Replace** the `### Workflow routing for Lens sessions` section with:

```markdown
### Workflow routing for Lens sessions

**ALWAYS use `workflow.run("lens-analysis", ...)` for Lens investigations — never `agents.call()` or `agents.fork()`.**

The `lens-analysis` workflow embeds D-o-R phase boundaries (SCOPE ≤3 ops → INVESTIGATE ≤10 → WRITE ≤5 → EXIT 1) directly into the child session's task string AND verifies the deliverable exists.

Investigation/analysis (most Lens sessions):
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}
deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

Code changes (cleanup/fix from a prior finding):
```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}
Prior finding: agents/tech-lead/workspace/${finding}.md
Files: ${explicitList}. Verify: tsc --noEmit + test. Budget: 30 ops.`)
```

Feature work:
```javascript
workflow.run("implement-and-verify", "Implement <feature> from dispatch-board. Files: <scope>. Test: <how to verify>.")
```

**NEVER dispatch Lens work via `agents.call()` or `agents.fork()`.** Those create unstructured sessions.
```

#### Change 3: Add pre-dispatch scope check to Step 2

At the end of Step 2 (DECIDE), before Step 3, add:

```markdown
### Pre-dispatch scope check for Lens work
Before dispatching a Lens session, verify:
- [ ] Target is ≤3 files
- [ ] You can write the objective in 1 sentence
- [ ] The deliverable filename is chosen (agents/tech-lead/workspace/<name>.md)

If you can't satisfy these, the scope is too broad. Split into 2+ sessions.
```

---

## Why This Should Work (vs Passive Text)

The original D-o-R text was added to the heartbeat on Apr 12, but **workflow adoption stayed at 0%** across 172 sessions because:

1. **Phase boundaries were in the heartbeat body** — child sessions never saw them
2. **Dispatch still used `agents.call/fork`** — no structural enforcement
3. **No verification gate** — nothing caught missing deliverables

The `lens-analysis` workflow fixes all three:
1. Phase boundaries are injected INTO the task string the child session receives
2. Dispatch goes through `workflow.run()` — tracked, structured
3. JS verification checks deliverable exists and is non-empty

## Expected Impact

| Metric | Before | Target | How measured |
|--------|--------|--------|-------------|
| Workflow adoption (Lens) | 0% | ≥50% in 48h | `sessions WHERE workflowRunId IS NOT NULL` |
| Avg ops/Lens session | 24.2 | ≤20 | Mean of Lens session opCount |
| 41+ op sessions | 6% (12/206) | ≤3% | Bucket analysis |
| Ops saved/day | — | ~370-560 | Sum reduction in total Lens ops |

## Measurement Queries

### Baseline (run now):
```sql
SELECT 
  CASE WHEN opCount<=20 THEN '1-20' WHEN opCount<=40 THEN '21-40' ELSE '41+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops, SUM(opCount) as total_ops
FROM sessions 
WHERE agent='tech-lead' AND task LIKE '%Lens%' AND startedAt > (strftime('%s','now')*1000 - 72*3600000)
GROUP BY 1;
```

### Post-deployment (+24h, +48h):
```sql
-- Workflow adoption
SELECT 
  COUNT(CASE WHEN workflowRunId IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as adoption_pct
FROM sessions 
WHERE agent='tech-lead' AND task LIKE '%Lens%' AND startedAt > {deployment_ts};

-- Op distribution
SELECT 
  CASE WHEN opCount<=20 THEN '1-20' WHEN opCount<=40 THEN '21-40' ELSE '41+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops
FROM sessions 
WHERE agent='tech-lead' AND task LIKE '%Lens%' AND startedAt > {deployment_ts}
GROUP BY 1;
```

## Risk Register

| Risk | Likelihood | Mitigation |
|------|:-:|-----------|
| Tech-lead doesn't apply heartbeat patch | Medium | Message sent via agents.message() — also request via May |
| Phase caps too tight (stub findings) | Low | Phase 2 has 10 ops — enough for 1-3 files |
| Workflow overhead on already-lean sessions | Low | Verify phase is pure JS, ~0 cost |
| lens-analysis not found by workflow loader | Low | Follows exact same pattern as verified-coder.ts |
