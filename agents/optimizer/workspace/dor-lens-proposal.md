# D-o-R Workflow Integration for Tech-Lead Lens Sessions

**Date**: 2026-04-13  
**Author**: Optimizer  
**Status**: Ready for deployment  
**Supersedes**: `agents/optimizer/workspace/tech-lead-dor-proposal.md` (earlier proposal; this adds concrete data and a tighter plan)

---

## Problem

Tech-lead runs ~14 Lens analysis sessions/day at **0% workflow adoption** (0 of 174 sessions in 48h used a workflow). The `lens-analysis` workflow exists, is wired in the heartbeat text, but is never actually called — sessions are dispatched via `agents.call()` / `agents.fork()`.

### 24h Op Distribution (Lens sessions only, n=70)

| Bucket | Sessions | Avg Ops | Total Ops | % of Total |
|--------|:--------:|:-------:|:---------:|:----------:|
| 1-20   | 55       | 6.7     | 371       | 40%        |
| 21-40  | 11       | 26.8    | 295       | 32%        |
| **41+**| **4**    | **63.8**| **255**   | **28%**    |
| **All**| **70**   | **13.2**| **921**   |            |

The 4 sessions in the 41+ bucket (6% of sessions) consume **28% of all Lens ops**. The worst offender: an 86-op session that could have been 20-25 ops with D-o-R phases.

### Root Cause (KE-020 applies)

The heartbeat already says "ALWAYS use `workflow.run("lens-analysis", ...)` — never `agents.call()` or `agents.fork()`" but the agent doesn't comply because:

1. **Workflow IS loadable** — `lens-analysis.ts` exists at `agents/tech-lead/workflows/` and the workflow engine uses directory scanning (not registry), so `workflow.run("lens-analysis", ...)` would work. But the agent has never tried calling it. This is a pure adoption failure.
2. **Cognitive load override** — under task pressure, the agent defaults to the simpler `agents.call()` pattern it's used thousands of times, ignoring the workflow routing instructions. Per KE-020: "building a feature ≠ agents using it."
3. **No enforcement gate** — nothing stops the heartbeat from dispatching via `agents.call()`. The instruction is advisory.
4. **Not in REGISTRY.md** — while the engine loads from disk, `lens-analysis` is missing from the Tech-Lead section of `agents/shared/workflows/REGISTRY.md`. Adding it increases discoverability when agents reference the registry.

---

## Solution: Three-Part Deployment

### Part 1: Lens Task Templates with D-o-R Phase Boundaries

These templates embed phase boundaries **inside the task string** so they travel WITH the child session:

#### Template A: Standard Lens Investigation (most common, ~80% of Lens sessions)

```
Lens ${lens}: ${specificTarget}

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

Total budget: ≤20 ops. Deliverable: agents/tech-lead/workspace/${findingName}.md
```

**Expected ops**: 15-20 (down from 25-65 for investigation sessions)

#### Template B: Lens + Code Cleanup (when acting on a prior finding)

```
Lens ${lens} cleanup: ${target}

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

Total budget: ≤25 ops. Fix ONLY what the finding doc describes.
```

**Expected ops**: 18-25 (down from 40-96 for cleanup sessions)

#### Template C: Multi-Branch Review Sprint

```
Lens A: Review branch merge sprint — ${branchCount} branches

## D-o-R PHASE BOUNDARIES (Hard Caps)

### Phase 1: INVENTORY (≤3 ops)
List all review branches. Triage: which are merge-ready, which have conflicts, which are stale.

### Phase 2: MERGE (≤2 ops per branch, ${branchCount * 2} ops max)
For each branch: check diff, merge if clean, note conflicts.
Do NOT resolve complex conflicts — note them for follow-up.

### Phase 3: CLEANUP (≤3 ops)
Delete merged branches. Update tracking.

### Phase 4: EXIT (1 op)
Call finish() with merge report.

Total budget: ≤${branchCount * 2 + 7} ops.
```

**Expected ops**: 15-25 for 6 branches (down from 63-96)

---

### Part 2: Recommended Heartbeat Edit

The heartbeat already has the correct workflow routing text (Step 3, "Workflow routing for Lens sessions"). The problem is compliance, not instructions. The fix is **two surgical changes**:

#### Change 1: Replace the `lens-analysis` dispatch example with embedded templates

**Current** (in heartbeat Step 3, "Workflow routing for Lens sessions"):
```markdown
Investigation/analysis (most Lens sessions):
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}
deliverable: agents/tech-lead/workspace/${findingName}.md`)
```
```

**Replace with**:
```markdown
Investigation/analysis (most Lens sessions):
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}

## D-o-R PHASE BOUNDARIES (Hard Caps)
Phase 1 SCOPE (≤3 ops): Read 1-3 target files. 1-sentence objective.
Phase 2 INVESTIGATE (≤10 ops): Gather evidence. No writing. No fixing.
Phase 3 WRITE (≤5 ops): Write to agents/tech-lead/workspace/${findingName}.md
Phase 4 EXIT (1 op): finish(). Note follow-ups, don't fix inline.

Total: ≤20 ops. Deliverable: agents/tech-lead/workspace/${findingName}.md`)
```
```

**Why**: The current template passes `deliverable:` but not the phase boundaries. The lens-analysis workflow _does_ inject phases via `buildPhasedTask()`, but the heartbeat text should reinforce them so the agent sees the pattern even before the workflow rewrites the task.

#### Change 2: Add anti-bypass guard to Step 3 ACT section

Add immediately after the "NEVER dispatch Lens work via `agents.call()` or `agents.fork()`" line:

```markdown
**Self-check before dispatching**: Did you write `workflow.run(` or `agents.call(`? 
If it's `agents.call` or `agents.fork`, STOP — rewrite as `workflow.run("lens-analysis", ...)`.
```

**Why**: This creates a moment of metacognitive pause. The agent is about to write a tool call — this instruction fires at exactly the right moment.

#### Change 3: Add `lens-analysis` to REGISTRY.md

The workflow file exists at `agents/tech-lead/workflows/lens-analysis.ts` and **is loadable** — the engine uses directory scanning, not registry lookup. However, `lens-analysis` is missing from the Tech-Lead section of `agents/shared/workflows/REGISTRY.md`. Adding it serves two purposes:
- Increases discoverability when agents or humans reference the registry
- Makes the workflow visible in `workflow.run("list")` output documentation

Add to the Tech-Lead section of REGISTRY.md:
```
| `lens-analysis` | `tech-lead/workflows/lens-analysis.ts` | 170 | D-o-R phased Lens investigation. Embeds phase boundaries + verifies deliverable. |
```

---

### Part 3: Expected Op Savings Per Session Type

Based on 72h data (19 sessions at 41+ ops):

| Session Type | Current Avg Ops | D-o-R Target | Savings/Session | Sessions/Day | Daily Savings |
|-------------|:-:|:-:|:-:|:-:|:-:|
| Standard Lens Investigation | 31 | 18 | 13 | ~8 | **104 ops** |
| Lens + Cleanup (fix-creep) | 58 | 25 | 33 | ~3 | **99 ops** |
| Multi-branch Review Sprint | 73 | 25 | 48 | ~0.5 | **24 ops** |
| Heartbeat bloat (41+ ops) | 43 | 8 | 35 | ~1 | **35 ops** |
| **Total estimated daily savings** | | | | | **~262 ops/day** |

#### Conservative estimate: **200+ ops/day**

This assumes:
- 50% of 21-40 op sessions brought down to ~18 ops (the compliant ones stay)
- 80% of 41+ op sessions brought down to 20-25 ops
- Some sessions legitimately need 30+ ops and the workflow lets them escalate

#### What "200 ops/day" means in practice:
- ~3 fewer high-op sessions per day
- ~20% reduction in tech-lead's total daily op spend
- Equivalent to saving ~2 full Lens sessions worth of compute per day

---

## Measurement Plan

### Pre-deployment baseline (already captured above)
- 24h: 70 Lens sessions, 13.2 avg ops, 0% workflow adoption
- 41+ bucket: 4 sessions (6%), 63.8 avg, 28% of total ops

### Post-deployment checks

```sql
-- Run at +24h, +48h, +72h
-- 1. Workflow adoption
SELECT COUNT(CASE WHEN workflowRunId IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as wf_pct
FROM sessions WHERE agent='tech-lead' AND task LIKE '%Lens%' 
AND startedAt > {deployment_time};

-- 2. Op distribution shift
SELECT 
  CASE WHEN opCount<=20 THEN '1-20' WHEN opCount<=40 THEN '21-40' ELSE '41+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops, SUM(opCount) as total_ops
FROM sessions WHERE agent='tech-lead' AND task LIKE '%Lens%' 
AND startedAt > {deployment_time}
GROUP BY bucket;

-- 3. Deliverable hit rate
SELECT COUNT(CASE WHEN status='success' THEN 1 END) * 100.0 / COUNT(*) as success_pct
FROM sessions WHERE agent='tech-lead' AND task LIKE '%Lens%' 
AND startedAt > {deployment_time};
```

### Success Criteria
- [ ] Workflow adoption ≥ 40% for Lens sessions within 48h
- [ ] Average Lens session ops ≤ 18 (from 13.2 — but 41+ bucket shrinks)
- [ ] 41+ op sessions drop from 6% to ≤ 2%
- [ ] No regression in deliverable quality

### Failure Signals
- **0% adoption persists** → workflow isn't registered/loadable (Part 2, Change 3)
- **Adoption >30% but ops don't drop** → Phase boundaries aren't being followed, need stronger caps or structural enforcement
- **Sessions bail at 5 ops with stub findings** → Phase 2 budget too tight, relax to ≤15

---

## Deployment Steps

1. Add `lens-analysis` to REGISTRY.md Tech-Lead section (discoverability — engine loads from disk but agents reference registry)
2. Apply heartbeat Change 1: embed phase boundaries in dispatch template
3. Apply heartbeat Change 2: add anti-bypass self-check
4. Monitor at +24h with measurement queries
5. If adoption <20% at +24h, investigate whether the agent is still calling `agents.call()` despite instructions — may need to **remove agents.call/fork from tech-lead's tool set** during Lens dispatch

---

## Appendix: Why the Existing Proposal Didn't Ship

The earlier `tech-lead-dor-proposal.md` (from earlier today) contained the same diagnosis and similar recommendations. It was marked "awaiting review before deployment." The heartbeat was already edited to include `lens-analysis` routing, but **the agent simply never called `workflow.run()`** — a pure adoption failure (KE-020). The workflow is loadable from disk; the problem is behavioral. This proposal adds:

1. Concrete task templates (3 variants for different Lens types)
2. Corrected root cause: adoption failure, not registration gap
3. The anti-bypass self-check (metacognitive pause)
4. Per-session-type savings estimates grounded in 72h data
