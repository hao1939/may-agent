# Tech-Lead D-o-R Workflow Integration Proposal

**Date**: 2026-04-13  
**Author**: Optimizer  
**Status**: Proposal — awaiting review before deployment

---

## 1. Problem Statement

Tech-lead runs ~14 Lens analysis sessions per day. Despite having D-o-R phase boundary text in the heartbeat since ~Apr 12, **workflow adoption is 0%** across the last 48h (0 of 172 sessions used a workflow). Sessions that SHOULD be capped at 20 ops routinely balloon:

| Op Range | Sessions (72h) | % of Lens Total | Avg Ops | Cumulative Ops |
|----------|:-:|:-:|:-:|:-:|
| 1-20 | 107 | 52% | 9.4 | 1,006 |
| 21-40 | 65 | 31% | 31.0 | 2,015 |
| 41-60 | 22 | 11% | 48.6 | 1,069 |
| 61-96 | 12 | 6% | 73.8 | 886 |
| **Total** | **206** | | **24.2 avg** | **4,976** |

The top 18% of sessions (41+ ops) consume **39% of all Lens ops**. The 96-op session alone equals ten lean sessions.

### Root Cause Analysis

The current heartbeat has good D-o-R text (Phase 1: SCOPE ≤3 ops → Phase 2: INVESTIGATE ≤10 ops → Phase 3: WRITE ≤5 ops → Phase 4: EXIT 1 op), but it fails because:

1. **It's passive guidance, not a workflow.** The text says "use these phase boundaries" but doesn't route through `workflow.run()`. The agent reads the instructions and then ignores them under cognitive load.
2. **No enforcement mechanism.** There's no gate that actually stops Phase 2 from expanding to 30+ ops. The "GATE: At 10 ops, STOP investigating" is advisory text that competes with the agent's drive to be thorough.
3. **The heartbeat calls `agents.call()` or `agents.fork()` instead of `workflow.run()`.** Looking at recent sessions, the heartbeat dispatches Lens work via `agents.call("tech-lead", "Lens B: ...")` — this creates a plain session with no workflow structure.
4. **Fix-creep**: The #1 anti-pattern ("I found dead code, let me delete it now") is documented but still happens in 31% of 40+ op sessions.

### Why Existing D-o-R Text Didn't Work

Per KE-020 (capability adoption requires explicit wiring): building a feature ≠ agents using it. The phase boundary text was added to the heartbeat body, but the **dispatch mechanism** was never changed. Tech-lead still forks plain sessions. The D-o-R phases are instructions to a child session that never sees them (they're in the heartbeat, not in the task description).

---

## 2. Proposed Solution: Workflow-Routed Lens Sessions

### 2A. D-o-R Workflow Template for Lens Sessions

Instead of passive text, route ALL Lens investigation sessions through `verify-wrap`:

```javascript
// In heartbeat Step 3, replace agents.call/fork for Lens work with:
workflow.run("verify-wrap", `Lens ${lens}: ${target}

## Phase Boundaries (HARD CAPS)
Phase 1 — SCOPE (≤3 ops): Read 1-3 target files. Write 1-sentence objective.
  GATE: If scope spans >3 files or >1000 lines, NARROW before proceeding.
Phase 2 — INVESTIGATE (≤10 ops): Read, grep, query. Do NOT write findings yet.
  GATE: At op 13 total, STOP. You have enough evidence.
Phase 3 — WRITE (≤5 ops): Write findings to agents/tech-lead/workspace/${findingName}.md
  GATE: File exists and is non-empty. You are DONE.
Phase 4 — EXIT (1 op): Call finish(). Do NOT start fixing what you found.

Budget: 20 ops max. If you found something worth fixing, note it as follow-up.
Deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Why verify-wrap?** It already exists, tech-lead knows it, and it adds a verification step that confirms the deliverable was written. This is the minimal viable integration — no new workflow needed.

### 2B. For Lens Sessions That Include Code Changes

Route through `implement-and-verify` instead:

```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}

Based on prior finding: agents/tech-lead/workspace/${priorFinding}.md
Files to change: ${fileList}
Verify: npm run check passes after changes.

Budget: 30 ops max. Scope limited to files listed above.`)
```

### 2C. Heartbeat Edit — Specific Changes

**Change 1: Replace the dispatch examples in Step 3**

Current text (the "Workflow routing for Lens sessions" section) already suggests `workflow.run()` but the actual task templates in the heartbeat don't embed phase boundaries. The fix: embed phase boundaries INSIDE the task string passed to `workflow.run()`, not as separate heartbeat instructions.

**Proposed replacement for the Lens session dispatch section:**

Replace the current "Workflow routing for Lens sessions" block with:

```markdown
### Workflow routing for Lens sessions

**ALWAYS use workflow.run() — never agents.call/fork for Lens work.**

Investigation (most Lens sessions):
```javascript
workflow.run("verify-wrap", `Lens ${lens}: ${specificTarget}

PHASE CAPS — these are hard stops, not suggestions:
- Phase 1 SCOPE (≤3 ops): Read target files. Write 1-line objective + deliverable path.
- Phase 2 INVESTIGATE (≤10 ops): Gather evidence. No writing yet.
- Phase 3 WRITE (≤5 ops): Write findings to agents/tech-lead/workspace/<name>.md
- Phase 4 EXIT (1 op): finish(). Do NOT fix anything — note follow-ups in the doc.

Total: ≤20 ops. Deliverable: agents/tech-lead/workspace/<name>.md`)
```

Code changes (cleanup/fix from a prior finding):
```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}
Prior finding: agents/tech-lead/workspace/<finding>.md
Files: <explicit list>. Verify: npm run check. Budget: 30 ops.`)
```

**NEVER dispatch Lens work via agents.call() or agents.fork().** Those create unstructured sessions.
```

**Change 2: Remove the standalone "Lens Phase Boundaries" section**

The current "📐 Lens Phase Boundaries (D-o-R for Investigations)" section should be **removed** because it puts the phase boundary instructions in the heartbeat body where child sessions can't see them. The same content now lives INSIDE the task string passed to `workflow.run()`, where the child session actually reads it.

**Change 3: Add a pre-dispatch scope check**

Add to Step 2 (DECIDE), after the current content:

```markdown
### Pre-dispatch scope check for Lens work
Before dispatching a Lens session, verify:
- [ ] Target is ≤3 files
- [ ] You can write the objective in 1 sentence
- [ ] The deliverable filename is chosen (agents/tech-lead/workspace/<name>.md)

If you can't satisfy these, the scope is too broad. Split into 2+ sessions.
```

---

## 3. Expected Impact

### Quantitative Estimate

**Conservative scenario** (only caps the 41+ op sessions):
- 34 sessions/72h above 41 ops → avg 57.5 ops → capped to ~25 ops avg
- Savings: 34 × 32.5 = **1,105 ops/72h** = ~368 ops/day

**Moderate scenario** (also brings 21-40 range closer to 20):
- Additional 65 sessions averaging 31 ops → brought to ~22 ops avg  
- Additional savings: 65 × 9 = 585 ops/72h = ~195 ops/day
- **Total: ~563 ops/day**

**Why this should work better than the passive text:**
1. Phase boundaries travel WITH the session (in the task string), not left behind in the heartbeat
2. verify-wrap adds a structural gate: if the deliverable file doesn't exist, verification fails
3. workflow.run() creates a tracked workflow run, making adoption measurable

### What Won't Change
- Heartbeat ops (already lean at 2-5 ops avg for recent heartbeats)
- Non-Lens work sessions (bug fixes, feature work — these already use implement-and-verify when dispatched by May)

---

## 4. Measurement Plan

### Baseline (capture before deployment)
```sql
-- 72h Lens session distribution pre-deployment
SELECT 
  CASE WHEN opCount<=20 THEN '1-20' WHEN opCount<=40 THEN '21-40' ELSE '41+' END as bucket,
  COUNT(*) as n, ROUND(AVG(opCount),1) as avg_ops, SUM(opCount) as total_ops
FROM sessions 
WHERE agent='tech-lead' AND task LIKE '%Lens%' AND startedAt > {now - 72h}
GROUP BY bucket;
```

### Post-deployment checks (at +24h, +48h, +72h)
1. **Workflow adoption rate**: `SELECT COUNT(CASE WHEN workflowRunId IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM sessions WHERE agent='tech-lead' AND task LIKE '%Lens%' AND startedAt > {deployment_time}`
2. **Op distribution shift**: Same bucket query as baseline — target: 41+ bucket drops from 6% to <2%
3. **Avg ops/session**: Target ≤18 (from current 24.2)
4. **Deliverable completion rate**: % of Lens sessions that produce a file in workspace/

### Success Criteria
- [ ] Workflow adoption ≥ 50% for Lens sessions within 48h
- [ ] Average Lens session ops ≤ 20 (from 24.2)
- [ ] 41+ op Lens sessions drop to ≤ 3% (from 6%)
- [ ] No regression in deliverable quality (findings docs still useful)

### Failure Modes to Watch
- **Over-constrained**: If sessions finish at 3-5 ops with empty/stub findings, the budget is too tight → relax Phase 2 to ≤15 ops
- **Workflow overhead**: If verify-wrap adds 5+ ops of overhead to sessions that were already lean → measure WF vs non-WF for sub-20 sessions
- **Adoption collapse**: If tech-lead reverts to agents.call within 48h → the dispatch text isn't sticky enough, need stronger enforcement

---

## 5. Deployment Plan

1. **Review this proposal** — get sign-off before editing heartbeat
2. **Edit heartbeat.md** — apply Changes 1-3 from section 2C above
3. **Do NOT edit anything else** — no skill files, no workflows, no agent.json
4. **Monitor at +24h** — run measurement queries from section 4
5. **Adjust at +48h** — if adoption <30%, investigate why and adjust dispatch text

---

## 6. Appendix: Current Heartbeat Sections to Modify

### Section to REPLACE (Change 1)
**Location**: Under "### Workflow routing for Lens sessions" in Step 3: ACT
**Current**: Three code blocks showing verify-wrap, implement-and-verify, and feature work routing
**New**: Updated code blocks with embedded phase boundaries in task strings

### Section to REMOVE (Change 2)  
**Location**: "### 📐 Lens Phase Boundaries (D-o-R for Investigations)" — the full subsection from the heading through "The #1 anti-pattern" note
**Reason**: Content migrated into the task string template (Change 1). Keeping both creates confusion about where the phases are enforced.

### Section to ADD (Change 3)
**Location**: End of Step 2: DECIDE, before Step 3
**Content**: Pre-dispatch scope check (3 checkboxes)

---

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|:-:|-----------|
| Agent ignores phase caps in task string | Medium | verify-wrap's verification step catches missing deliverables |
| Sessions too short, findings shallow | Low | Phase 2 has 10 ops — enough for thorough investigation of 1-3 files |
| Heartbeat itself bloats from longer dispatch code | Low | Dispatch template is copy-paste, not reasoning |
| Workflow engine adds overhead | Low | verify-wrap is 2 phases (work + verify), minimal structural cost |
| Per KE-015: R < 0.3 means workflows hurt | Low | Lens sessions have R > 0.5 — they're investigative with decision points |
