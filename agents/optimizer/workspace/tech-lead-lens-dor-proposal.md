# D-o-R Workflow Integration for Tech-Lead Lens Sessions

**Date**: 2026-04-15  
**Author**: Optimizer  
**Status**: Proposal v3 — Consolidates prior proposals (Apr 13, Apr 14) with fresh 24h data  
**Supersedes**: `dor-lens-proposal.md` (Apr 13), `tech-lead-dor-proposal.md` v2 (Apr 14)

---

## Executive Summary

Tech-lead runs ~14 Lens sessions/day at **0% workflow adoption** (0 of 53 sessions in the last 24h used `workflow.run()`). The `lens-analysis` workflow exists, is wired in heartbeat text, but is never called — sessions dispatch via `agents.call()`. Six sessions in the last 24h exceeded 40 ops (avg 99 ops each), consuming 594 ops — **56% of all tech-lead ops** from just **11% of sessions**.

D-o-R phase boundaries would cap these at 20-25 ops. **Conservative estimate: 200+ ops/day savings** at 50% compliance.

### Root Cause Stack (ordered by impact)
1. **Workflow engine bug** — `ctx.agent` resolved to `"undefined"` (fix on main but binary may not have been restarted). This makes `workflow.run("lens-analysis", ...)` fail silently, forcing fallback to `agents.call()`.
2. **Habit inertia (KE-020)** — Agent has used `agents.call()` thousands of times. Text instructions don't override ingrained patterns.
3. **No enforcement gate** — Nothing structurally prevents `agents.call()` dispatch for Lens work.

---

## 1. Lens Task Templates with D-o-R Phase Boundaries

Each template embeds phase boundaries **in the task string** so they travel with the child session, surviving workflow handoff.

### Template A: Standard Lens Investigation (~80% of Lens sessions)

**Use when**: Routine lens rotation (A/B/C/D), architectural review, dead weight audit, flow tracing.

```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}

## D-o-R PHASE BOUNDARIES (Hard Caps)

### Phase 1: SCOPE (≤3 ops)
Read 1-3 target files. Write a 1-sentence objective.
GATE: If scope > 3 files or > 1000 lines, NARROW before proceeding.

### Phase 2: INVESTIGATE (≤10 ops)
Gather evidence: read, grep, query. Do NOT write the deliverable yet.
Do NOT fix, delete, or refactor anything you find.
GATE: At op ~13 total, STOP. You have enough.

### Phase 3: WRITE (≤5 ops)
Write findings to: agents/tech-lead/workspace/${findingName}.md
Include: summary, evidence with file:line refs, severity, recommended action.
GATE: File exists and is non-empty.

### Phase 4: EXIT (1 op)
Call finish(). Do NOT fix what you found — note follow-ups in the doc.

Total budget: ≤20 ops. Deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Current observed range**: 4-86 ops  
**Target with D-o-R**: 15-20 ops  
**Savings per session**: ~13 ops average (for sessions that currently exceed 20 ops)

### Template B: Lens + Code Cleanup (acting on prior finding)

**Use when**: A prior Lens finding identified dead code, fragility, or refactor target. Now implementing the fix.

```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}

Prior finding: agents/tech-lead/workspace/${priorFinding}.md
Files to change: ${explicitFileList}

## D-o-R PHASE BOUNDARIES (Hard Caps)

### Phase 1: ORIENT (≤3 ops)
Read the prior finding doc and the target files. Confirm the changes are still valid.

### Phase 2: IMPLEMENT (≤15 ops)
Make the code changes. Keep scope to listed files only.

### Phase 3: VERIFY (≤5 ops)
Run tsc --noEmit and relevant tests. Fix any breakage.

### Phase 4: EXIT (1 op)
Call finish() with summary of changes made.

Total budget: ≤25 ops. Fix ONLY what the finding doc describes.`)
```

**Current observed range**: 40-96 ops  
**Target with D-o-R**: 18-25 ops  
**Savings per session**: ~33 ops average

### Template C: Multi-Branch Review Sprint

**Use when**: Accumulated review branches need triaging and merging.

```javascript
workflow.run("implement-and-verify", `Review branch merge sprint — ${branchCount} branches

## D-o-R PHASE BOUNDARIES (Hard Caps)

### Phase 1: INVENTORY (≤3 ops)
List all review branches. Triage: merge-ready vs conflicts vs stale.

### Phase 2: MERGE (≤2 ops per branch, ${branchCount * 2} ops max)
For each: check diff, merge if clean, note conflicts.
Do NOT resolve complex conflicts — note for follow-up.

### Phase 3: CLEANUP (≤3 ops)
Delete merged branches. Update tracking.

### Phase 4: EXIT (1 op)
Call finish() with merge report.

Total budget: ≤${branchCount * 2 + 7} ops.`)
```

**Current observed range**: 63-94 ops  
**Target with D-o-R**: 15-25 ops for 6 branches  
**Savings per session**: ~48 ops average

### Template D: Feature Implementation (dispatch board items)

**Use when**: Feature rotation cycle from dispatch board.

```javascript
workflow.run("implement-and-verify", `Implement: ${feature}
From dispatch board. Files: ${scopedFileList}. Test: ${verificationMethod}. Budget: 30 ops.`)
```

**Target**: 20-30 ops

---

## 2. Heartbeat Integration Plan

The heartbeat (`agents/tech-lead/heartbeat.md`) already contains D-o-R phase boundaries and workflow routing (added Apr 13). Three surgical changes are needed — all additive, no restructuring (per KE-008).

### Change 1: Embed phase boundaries in the dispatch template (Step 3)

**Current** (line ~130, "Workflow routing for Lens sessions"):
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}
deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Replace with**:
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}

## D-o-R PHASE BOUNDARIES (Hard Caps)
Phase 1 SCOPE (≤3 ops): Read 1-3 target files. 1-sentence objective.
Phase 2 INVESTIGATE (≤10 ops): Gather evidence. No writing. No fixing.
Phase 3 WRITE (≤5 ops): Write to agents/tech-lead/workspace/${findingName}.md
Phase 4 EXIT (1 op): finish(). Note follow-ups, don't fix inline.

Total: ≤20 ops. Deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Why**: The current template passes `deliverable:` but omits phase boundaries. The `lens-analysis.ts` workflow injects them via `buildPhasedTask()`, but reinforcing them in heartbeat text means the agent sees the pattern *before* the workflow rewrites the task.

### Change 2: Strengthen anti-bypass guard (Step 3)

**Add after** the existing "NEVER dispatch Lens work via `agents.call()` or `agents.fork()`" line:

```markdown
**Self-check before dispatching**: Look at what you're about to write. Is it `workflow.run(` or `agents.call(`?
If it's `agents.call` or `agents.fork` for any Lens/analysis session, STOP — rewrite as `workflow.run("lens-analysis", ...)`.
This is the #1 cause of 40+ op sessions. The workflow embeds phase boundaries that keep you at ≤20 ops.
```

**Why**: Creates a metacognitive pause at the exact moment of dispatch. The agent is about to write a tool call — this fires at the right moment to interrupt the `agents.call()` habit.

### Change 3: Add workflow adoption self-check to Step 4 EXIT

**Add before the final line of Step 4**:

```markdown
**Workflow check**: Did you dispatch via `workflow.run()`? If not, note why in your finish() summary.
```

**Why**: Self-monitoring creates accountability. Even if the agent bypasses, it must acknowledge doing so, which makes the pattern visible in session logs for optimizer review.

### What NOT to change
- Do NOT reorder, merge, or rename Steps 1-4 (KE-008: structural changes cause regressions)
- Do NOT add more than one behavioral intervention (KE-123: stacking degrades performance by 12-15pp)
- The core intervention is Change 2 (anti-bypass guard). Changes 1 and 3 are reinforcement, not additional interventions.

---

## 3. Expected Ops Savings Per Session Type

### Current 24h Baseline (Apr 14-15)

| Metric | Value |
|--------|-------|
| Total tech-lead sessions | 53 |
| Workflow adoption | **0%** (0 of 53) |
| Avg ops (all) | 19.9 |
| Sessions ≤20 ops | 40 (75%) — avg 6.7, total 268 ops |
| Sessions 21-40 ops | 7 (13%) — avg 27.3, total 191 ops |
| Sessions 41+ ops | 6 (11%) — avg 99.0, total 594 ops |
| Total ops | ~1,053 |
| **% from 41+ bucket** | **56%** |

### Savings Model

| Session Type | Current Avg | D-o-R Target | Saved/Session | Est. Sessions/Day | Daily Savings |
|:---|:---:|:---:|:---:|:---:|:---:|
| 41+ op investigations (sprawl) | 99 | 20 | 79 | ~3 | **237 ops** |
| 21-40 op sessions (mild bloat) | 27 | 18 | 9 | ~3.5 | **32 ops** |
| ≤20 op sessions (already lean) | 6.7 | 6.7 | 0 | ~20 | **0 ops** |
| **Total at 100% compliance** | | | | | **~269 ops/day** |

### Compliance-Adjusted Estimates

| Compliance | Daily Savings | Notes |
|:---:|:---:|:---|
| 25% | ~67 ops | Workflow bug unfixed; only text compliance helps |
| 50% | ~135 ops | Workflow working + anti-bypass guard |
| 75% | ~202 ops | Strong adoption with self-check enforcement |
| 100% | ~269 ops | Theoretical max — unrealistic |

**Target: 50-75% compliance → 135-202 ops/day savings**

The headline "200+ ops/day" is achievable at ~75% compliance. Even at 50%, the 41+ bucket shrinks dramatically — those 6 sessions at 99 avg ops are where most savings live.

### What "200 ops/day" means
- ~19% reduction in tech-lead's total daily ops
- 3 fewer 60+ op sessions per day
- Equivalent cost of ~2 full standard Lens sessions saved
- The single 272-op outlier (observed yesterday) would have been capped at 25 ops — a 247-op savings in one session

---

## 4. Implementation Steps

### Step 0: PREREQUISITE — Verify Workflow Engine Fix (P0)

The `lens-analysis` workflow requires `ctx.agent` to resolve correctly. A fix exists on main (commit `fc29e7e`) but may not be running.

```bash
# Test if workflow.run("lens-analysis", ...) works
export PATH=".state/.bun/bin:$PATH"
# Check if the process binary includes the ctx.agent fix
grep -r "ctx.agent" agents/tech-lead/workflows/lens-analysis.ts
```

**If broken**: Restart the process to pick up the fix. Without this, adoption will remain 0% because `workflow.run()` fails silently and the agent rationally falls back to `agents.call()`.

### Step 1: Apply Heartbeat Changes

All three changes go into `agents/tech-lead/heartbeat.md`:

1. **Change 1**: Replace the lens-analysis dispatch template in Step 3 with the version that includes phase boundaries (see Section 2 above)
2. **Change 2**: Add the anti-bypass self-check after the "NEVER dispatch" line in Step 3
3. **Change 3**: Add the workflow adoption self-check to Step 4

Estimated diff: +15 lines, -3 lines. No structural changes to steps.

### Step 2: Verify REGISTRY.md Entry

Check `agents/shared/workflows/REGISTRY.md` for `lens-analysis`:

```bash
grep "lens-analysis" agents/shared/workflows/REGISTRY.md
```

If missing, add to the Tech-Lead section:
```
| `lens-analysis` | `tech-lead/workflows/lens-analysis.ts` | 170 | D-o-R phased Lens investigation. Embeds phase boundaries + verifies deliverable. |
```

### Step 3: Monitor (+24h)

```sql
-- Run via bun -e with bun:sqlite

-- 1. Workflow adoption rate
SELECT 
  COUNT(CASE WHEN workflowRunId IS NOT NULL THEN 1 END) as with_wf,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN workflowRunId IS NOT NULL THEN 1 END) / COUNT(*), 1) as wf_pct
FROM sessions 
WHERE agent='tech-lead' AND startedAt > {deployment_epoch_ms};

-- 2. Op distribution shift
SELECT 
  CASE WHEN opCount<=20 THEN '≤20' WHEN opCount<=40 THEN '21-40' ELSE '41+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops, SUM(opCount) as total
FROM sessions WHERE agent='tech-lead' AND startedAt > {deployment_epoch_ms}
GROUP BY bucket;

-- 3. Phase-boundary compliance (text marker)
SELECT COUNT(CASE WHEN task LIKE '%D-o-R PHASE%' THEN 1 END) as phased,
  COUNT(*) as total
FROM sessions WHERE agent='tech-lead' AND startedAt > {deployment_epoch_ms}
AND task LIKE '%Lens%';
```

### Step 4: Evaluate (+48h)

| Signal | Threshold | Action |
|--------|:---------:|--------|
| Adoption ≥40% | ✅ Success | Continue monitoring |
| Adoption 20-40% | ⚠️ Partial | Investigate bypass patterns |
| Adoption <10% | ❌ Failure | Consider structural enforcement (see below) |
| 41+ sessions drop to ≤2% | ✅ Op savings confirmed | |
| Avg lens ops ≤18 | ✅ Phase budgets working | |
| Sessions bail at <5 ops with stub findings | ⚠️ Too tight | Relax Phase 2 to ≤15 ops |

### Step 5: Escalation (if <10% adoption at +48h)

If text-based interventions fail completely, the next option is **structural enforcement**: modify the tech-lead harness to intercept `agents.call()` during Lens dispatch and auto-route through `workflow.run("lens-analysis", ...)`. This is more invasive but guarantees adoption. However, per KE-002, text rules don't fix judgment failures — if the agent is choosing `agents.call()` deliberately, structural enforcement may be needed.

---

## Appendix A: Prior Proposals and What Changed

| Version | Date | Key Addition |
|---------|------|-------------|
| v1 (`dor-lens-proposal.md`) | Apr 13 | Initial templates, 3 variants, measurement plan |
| v2 (`tech-lead-dor-proposal.md`) | Apr 14 | Root cause: ctx.agent bug. Compliance sensitivity analysis |
| **v3 (this file)** | Apr 15 | Fresh 24h data, consolidated templates, implementation steps, KE-008 compliance |

### What's new in v3:
- **Updated data**: 53 sessions in last 24h (vs 70 and 158 in prior proposals)
- **Sharpened savings**: 41+ bucket is 56% of all ops (was 28% in v1 data) — even higher ROI than estimated
- **KE-008 compliance**: Explicitly flags what NOT to change in heartbeat
- **KE-123 compliance**: Single intervention (anti-bypass guard) with two reinforcements, not 3 stacked interventions
- **Escalation path**: Structural enforcement option if text fails

## Appendix B: Already Deployed Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| `lens-analysis.ts` workflow | ✅ On disk | `agents/tech-lead/workflows/lens-analysis.ts` |
| Phase boundary injection | ✅ In workflow | `buildPhasedTask()` at line ~80 |
| Post-session file verification | ✅ In workflow | JS-based, no LLM cost |
| Heartbeat workflow routing table | ✅ Deployed | Step 3 of heartbeat |
| Heartbeat "NEVER agents.call" text | ✅ Deployed | Step 3 of heartbeat |
| Pre-dispatch scope check | ✅ Deployed | Step 3 of heartbeat |
| **Anti-bypass self-check** | ❌ Missing | Proposed Change 2 |
| **EXIT workflow check** | ❌ Missing | Proposed Change 3 |
| **Process restart (ctx.agent fix)** | ❓ Unknown | Requires verification |
