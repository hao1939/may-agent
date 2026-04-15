# D-o-R Workflow Integration Proposal for Tech-Lead Lens Sessions

**Date**: 2026-04-14  
**Author**: Optimizer  
**Status**: Revision — prior deployment partially landed, adoption still 0%

---

## Executive Summary

Tech-lead runs ~14 analysis sessions/day (158 sessions in last 48h, avg 17.6 ops, max 272). **22 sessions exceeded 30 ops** consuming disproportionate compute. A D-o-R (Definition-of-Ready) workflow integration was deployed on Apr 13 (commit e90d08d6), including a `lens-analysis.ts` workflow with phase boundaries. **Adoption remains at 0%** — the agent still dispatches via `agents.call()`. This revised proposal addresses the adoption gap with stronger enforcement and refined phase budgets.

### Why Prior Deployment Failed
1. `workflow.run("lens-analysis", ...)` was broken due to `ctx.agent` resolving to `"undefined"` (deployment gap — fix on main but binary not restarted)
2. Agent fell back to `agents.call()` and the habit persisted even after heartbeat text was updated
3. No enforcement gate prevents non-workflow dispatch

---

## 1. D-o-R Phase Boundaries for Lens Tasks

### Phase Model (4 gates)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────┐
│ Phase 1: SCOPE  │───►│ Phase 2: ANALYZE  │───►│ Phase 3: WRITE  │───►│  EXIT    │
│    ≤3 ops       │    │    ≤10 ops        │    │    ≤5 ops       │    │  1 op    │
│                 │    │                   │    │                 │    │          │
│ Read targets    │    │ Gather evidence   │    │ Write findings  │    │ finish() │
│ State objective │    │ No writing        │    │ To deliverable  │    │          │
│ Narrow if >3    │    │ No fixing         │    │ Summary+evidence│    │          │
│ files           │    │                   │    │                 │    │          │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────┘
         │ GATE               │ GATE                  │ GATE
         │                    │                       │
    Scope ≤3 files?     At ~13 total ops,       File exists and
    ≤1000 lines?        stop investigating      is non-empty?
```

**Total budget: ≤20 ops** (down from current avg ~31 for >20-op sessions)

### Gate Enforcement
Gates are embedded in the task string by `lens-analysis.ts` workflow (line 80-118). The workflow also does post-session JS-based file verification (no LLM cost) to catch missing deliverables.

### Fix-Creep Guard
The #1 bloat pattern is "I found dead code → let me delete it now." The phase boundaries explicitly say: *"Do NOT fix, delete, or refactor anything you find"* and *"The fix is a SEPARATE session."*

---

## 2. Lens Task Templates (with op budgets per phase)

### Template A: Standard Investigation (~80% of sessions)

**Use when**: Routine lens rotation (A/B/C/D), architectural review, dead weight audit

```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}

## D-o-R PHASE BOUNDARIES (Hard Caps)
Phase 1 SCOPE (≤3 ops): Read 1-3 target files. 1-sentence objective.
Phase 2 INVESTIGATE (≤10 ops): Gather evidence. No writing. No fixing.
Phase 3 WRITE (≤5 ops): Write to agents/tech-lead/workspace/${findingName}.md
Phase 4 EXIT (1 op): finish(). Note follow-ups, don't fix inline.

Total: ≤20 ops. Deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Op budget**: 15-20 ops  
**Current observed**: 4-86 ops (highly variable without phases)

### Template B: Code Cleanup (acting on prior finding)

**Use when**: Lens found dead code/fragility, now implementing the fix

```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}
Prior finding: agents/tech-lead/workspace/${finding}.md
Files: ${explicitList}. Verify: tsc --noEmit + test. Budget: 25 ops.`)
```

**Op budget**: 18-25 ops  
**Current observed**: 40-96 ops for cleanup sessions

### Template C: Review Branch Merge Sprint

**Use when**: Accumulated review branches need merging

```javascript
workflow.run("implement-and-verify", `Review branch merge sprint — ${branchCount} branches
Triage: list all review/* branches, check diff, merge if clean, note conflicts.
Use scripts/review-merge.sh for each. Budget: ${branchCount * 2 + 7} ops.`)
```

**Op budget**: 15-25 ops for 6 branches  
**Current observed**: 63-94 ops

### Template D: Feature Implementation (dispatch board items)

**Use when**: Feature rotation cycle, item from dispatch board

```javascript
workflow.run("implement-and-verify", `Implement: ${feature}
Files: ${scopedFileList}. Test: ${verificationMethod}. Budget: 30 ops.`)
```

**Op budget**: 20-30 ops

---

## 3. Suggested Heartbeat Changes

The heartbeat (`agents/tech-lead/heartbeat.md`) already contains D-o-R phase boundaries and workflow routing (added Apr 13, commit e90d08d6). Three additional changes are needed:

### Change 1: Strengthen the anti-bypass guard (Step 3)

**Current text** (after "NEVER dispatch Lens work via `agents.call()` or `agents.fork()`."):
```
Those create unstructured sessions.
```

**Replace with**:
```markdown
Those create unstructured sessions.

**Self-check before dispatching**: Look at what you're about to write. Is it `workflow.run(` or `agents.call(`? 
If it's `agents.call` or `agents.fork` for a Lens session, STOP and rewrite as `workflow.run("lens-analysis", ...)`.
This is the #1 cause of 40+ op sessions. The workflow embeds phase boundaries that keep you at ≤20 ops.
```

**Why**: Creates a metacognitive pause at the exact moment of dispatch. The agent needs to interrupt its default `agents.call()` habit.

### Change 2: Add workflow adoption tracking to Step 4 EXIT

**Add before the final `[SIG:` line**:
```markdown
**Workflow check**: Did you dispatch via `workflow.run()`? If not, note why in your finish() summary.
```

**Why**: Self-monitoring creates accountability. Even if the agent bypasses, it must acknowledge doing so.

### Change 3: Fix the workflow engine bug first (prerequisite)

The `lens-analysis` workflow requires `ctx.agent` to resolve correctly. This fix exists on main (commit `fc29e7e`) but the running binary predates it. **A process restart is required before workflow adoption can succeed.**

Without the restart, `workflow.run("lens-analysis", ...)` will fail with `Agent "undefined" not registered`, and the agent will rationally fall back to `agents.call()`.

**Priority**: P0 — this is the actual root cause of 0% adoption.

---

## 4. Expected Savings Calculation

### Baseline (last 48h, 158 tech-lead sessions)

| Metric | Value |
|--------|-------|
| Total sessions | 158 |
| Avg ops | 17.6 |
| Max ops | 272 |
| Sessions > 20 ops | 38 (24%) |
| Sessions > 30 ops | 22 (14%) |
| Total ops (all) | ~2,781 |

### Savings Model

The high-op sessions are where D-o-R saves the most:

| Bucket | Sessions/48h | Avg Ops Now | Target w/ D-o-R | Saved/Session | Total Saved/48h |
|--------|:-----------:|:-----------:|:---------------:|:-------------:|:---------------:|
| >50 ops (investigations that sprawled) | 10 | ~73 | 20 | 53 | **530** |
| 31-50 ops (moderate bloat) | 12 | ~38 | 20 | 18 | **216** |
| 21-30 ops (mild bloat) | 16 | ~24 | 18 | 6 | **96** |
| ≤20 ops (already lean) | 120 | ~9 | 9 | 0 | **0** |
| **Total saved per 48h** | | | | | **842 ops** |

### Daily Savings: ~420 ops/day

Conservative estimate (50% compliance): **~210 ops/day**

### What This Means
- ~12% reduction in tech-lead's total daily op spend
- Equivalent to eliminating ~6 bloated sessions/day
- The 272-op outlier alone would save ~250 ops (budget: 20 ops for investigation phase)
- At ~14 sessions/day × 17.6 avg = 246 daily ops. Targeting 14 × 12 = 168 daily ops. **Net savings: ~78 ops/day** on average, **but up to 400+ ops/day from outlier prevention**

### Sensitivity Analysis

| Compliance Rate | Daily Savings | Notes |
|:-:|:-:|---|
| 25% | ~105 ops | Workflow bug unfixed, partial text compliance only |
| 50% | ~210 ops | Workflow working but agent sometimes bypasses |
| 75% | ~315 ops | Strong adoption with self-check |
| 100% | ~420 ops | Full adoption (unrealistic but theoretical max) |

---

## 5. Deployment Sequence

### Phase 0 (Prerequisite): Process Restart
- Deploy main → rebuild binary → restart
- This activates: `ctx.agent` fix (fc29e7e), turn budget enforcement, and all accumulated fixes
- **Without this, workflow adoption will remain 0%**

### Phase 1 (Day 1): Heartbeat Changes
1. Apply Change 1 (anti-bypass guard strengthening)
2. Apply Change 2 (workflow adoption self-check in EXIT)
3. Verify `lens-analysis` in `REGISTRY.md` (already exists per commit e90d08d6)

### Phase 2 (Day 1-2): Monitor
```sql
-- Workflow adoption rate
SELECT 
  COUNT(CASE WHEN task LIKE '%D-o-R PHASE%' THEN 1 END) as phased,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN task LIKE '%D-o-R PHASE%' THEN 1 END) / COUNT(*), 1) as pct
FROM sessions 
WHERE agent='tech-lead' AND startedAt > {deployment_epoch_ms}
AND task LIKE '%Lens%';

-- Op distribution shift  
SELECT 
  CASE WHEN opCount<=20 THEN '≤20' WHEN opCount<=30 THEN '21-30' 
       WHEN opCount<=50 THEN '31-50' ELSE '51+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops
FROM sessions WHERE agent='tech-lead' AND startedAt > {deployment_epoch_ms}
GROUP BY bucket;
```

### Phase 3 (Day 3): Evaluate
- **Success**: Workflow adoption ≥40%, avg lens ops ≤18, >50-op sessions ≤2%
- **Partial**: Adoption ≥20% but ops not dropping → phase boundaries too loose
- **Failure**: Adoption <10% → consider removing `agents.call` tool from tech-lead during Lens dispatch (structural enforcement)

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| Process restart not done → 0% adoption continues | HIGH | HIGH | Flag as P0 blocker — no other changes matter without it |
| Phase budgets too tight → shallow/stub findings | LOW | MEDIUM | Phase 2 has 10-op budget which is generous; monitor quality |
| Agent circumvents by not calling workflow | MEDIUM | MEDIUM | Self-check in EXIT catches this; long-term: structural enforcement |
| Workflow engine bug (other than ctx.agent) | LOW | HIGH | lens-analysis.ts is well-tested pattern based on verify-wrap |

---

## Appendix: What's Already Deployed vs What's Missing

### ✅ Already on main (commit e90d08d6 + subsequent)
- `agents/tech-lead/workflows/lens-analysis.ts` — 170-line workflow with D-o-R phases + file verification
- Heartbeat Step 3 includes workflow routing table with `lens-analysis` row
- Heartbeat includes "NEVER dispatch via agents.call/fork" instruction
- Heartbeat includes pre-dispatch scope check (≤3 files, 1-sentence objective)
- D-o-R phase boundaries embedded in heartbeat text

### ❌ Missing / Not Working
- **Process restart** — `ctx.agent` fix not deployed (binary predates fc29e7e)
- **Anti-bypass self-check** — not in heartbeat (proposed Change 1)
- **EXIT workflow check** — not in heartbeat (proposed Change 2)
- **REGISTRY.md entry** — may be missing (check and add if needed)

### 📊 Current State (Apr 14)
- Tech-lead workflow adoption: **0%** (0 of 158 sessions in 48h used a workflow)
- Avg ops: **17.6** (lower than the ~31 cited earlier, possibly due to turn budget deployment)
- Max ops: **272** (a Guards-v2 implementation session, not a Lens session)
- Sessions >30 ops: **22** (14% of total, consuming ~46% of ops)
