# Finding: Coach Workflow Adoption — Root Cause & Structural Fix

**Date**: 2026-04-14 04:30 UTC  
**Analyst**: optimizer  
**Request**: req:0b3a3445  

## Executive Summary

Coach workflow adoption is **0%**, not 53%. The prior finding's 53% measured task-text mentions of workflow names — a proxy for intent, not execution. In reality, across 79 coach sessions on Apr 13, **zero** had `workflowRunId` populated. Coach's heartbeat instructs it to use `workflow.run()` but every forked work session uses `agents.fork()` instead. This is a systemic behavioral pattern, not a per-session judgment failure.

## 1. The Measurement Error

The prior finding (finding-workflow-health-0414.md) reported coach at 53% adoption. This was computed by counting sessions whose task text contained workflow names like `verify-wrap`, `growth-cycle`, etc.

**Actual adoption by `workflowRunId`:**
| Period | Coach Sessions | workflowRunId Set | Real Rate |
|--------|---------------|-------------------|-----------|
| Apr 13 (full day) | 79 | 0 | **0.0%** |
| Apr 12-14 (48h) | 159 | 2 | **1.3%** |

The 2 workflow sessions in 48h were gym-related child sessions spawned by a single workflow run, not heartbeat-dispatched work.

**System-wide reality**: Only 34/506 sessions (6.7%) on Apr 13 had `workflowRunId` set. QA (reported 100%) and evaluator (reported 98%) also showed 0% by this metric. The entire workflow adoption narrative needs re-baselining.

## 2. Root Cause Analysis

### 2a. Coach dispatches via `agents.fork()`, not `workflow.run()`

Coach's session source distribution (48h):
| Source | Count | Description |
|--------|-------|-------------|
| null | 76 | Heartbeats (cron-triggered) |
| agents.fork | 68 | Work sessions forked from heartbeats |
| cron | 10 | Cron handler sessions |
| callAgent | 3 | Called by another agent |
| workflow | 2 | Spawned by workflow infrastructure |

**68 forked work sessions, 0 via workflow.run().** The heartbeat's Step 3 (DISPATCH) contains a detailed workflow routing table and examples showing `workflow.run()` calls. But coach consistently uses `agents.fork()` with detailed task descriptions instead.

### 2b. Why coach ignores the workflow routing

1. **Instruction complexity**: The heartbeat has 4 workflow routing examples, phase structure tables, and detailed budgets — but the agent must choose between `agents.fork()` (which it knows from core tooling) and `workflow.run()` (which requires specific parameter formatting). Fork is simpler.

2. **No enforcement mechanism**: The heartbeat says "Default: Use workflows for all forked work" but this is advisory text. KE-007 established that workflow enforcement is the ONLY reliable behavioral intervention — text rules don't change behavior.

3. **Task description includes workflow name**: When coach writes task descriptions like "[WORK SESSION] EXP-156 Design: Hard Gate Generalization Study", the workflow name isn't referenced. The heartbeat examples show `workflow.run('growth-cycle', task)` but the actual dispatching code uses `agents.fork(task)`.

4. **Heartbeat budget pressure**: Coach heartbeats target ≤8 ops with hard ceiling of 10. Calling `workflow.run()` (which blocks and runs the full workflow) would consume the entire heartbeat budget. The heartbeat actually instructs "Call workflow.run() directly from the heartbeat — don't embed workflow hints in fork task text. The workflow blocks this session, which is fine (heartbeats have 30+ min gaps)." But this contradicts the ≤10 op budget — a workflow.run that triggers a 35-op work session would blow through the heartbeat's budget.

### 2c. The structural contradiction

The heartbeat says two contradictory things:
- "Hard budget: ≤10 ops per heartbeat"
- "Call workflow.run() directly from the heartbeat — the workflow blocks this session"

If the workflow runs as part of the heartbeat session, the heartbeat would consume 35+ ops (the work session budget). This makes workflow.run() **structurally incompatible** with the heartbeat's op budget. The agent resolves this contradiction by using agents.fork() — the only way to dispatch work AND stay under 10 ops.

## 3. Session Type Breakdown

| Category | Sessions (48h) | With WF | Adoption | Avg Ops |
|----------|----------------|---------|----------|---------|
| Heartbeat | 83 | 0 | 0% | 6.0 |
| Work Session | 58 | 1 | 2% | 32.7 |
| Cron (reflect, verify, research-intake) | 10 | 0 | 0% | 19.0 |
| Other (dispatched tasks) | 11 | 0 | 0% | 19.0 |
| Investigation | 3 | 0 | 0% | 41.3 |
| Gym-related | 2 | 1 | 50% | 34.5 |
| Regression check | 1 | 0 | 0% | 83.0 |

**Work sessions are the target**: 58 sessions at 2% adoption, averaging 32.7 ops. These are experiments (EXP-XXX), investigations, and deployments — exactly what workflows structure.

Heartbeats at 0% is fine — heartbeats ARE the dispatcher, not the work.

## 4. Structural Fix Proposal

### Problem: `workflow.run()` from heartbeat is structurally impossible

The fix is NOT to add more workflow routing text to the heartbeat. KE-007 says text instructions don't work for behavioral change. And the structural contradiction (workflow.run blocks → blows heartbeat budget) makes the current approach unworkable.

### Option A: Make the dispatcher (heartbeat) use workflow.run() — REJECTED
This would require removing the heartbeat op budget or making it dynamic, which breaks the lean heartbeat design that's working well (avg 6 ops).

### Option B: Make forked work sessions self-wrap in workflows — RECOMMENDED
Instead of the heartbeat calling `workflow.run()`, the **forked work sessions** should self-select and run a workflow internally. This means:

1. Add a **workflow self-selection instruction** to the work session task template in the heartbeat
2. The forked session reads the instruction, calls `workflow.run()` as its first action
3. The workflow runs within the forked session's budget (35 ops)

### Concrete heartbeat change:

In Step 3 (DISPATCH), replace the current workflow.run() examples (which suggest calling from heartbeat) with fork-with-workflow-instruction pattern:

**Current** (broken): Coach heartbeat calls `workflow.run('growth-cycle', task)` directly  
**Proposed** (working): Coach heartbeat calls `agents.fork(task)` where task includes:  
```
⚡ WORKFLOW: Use workflow.run('<name>', '<subtask>') as your first action.
```

This moves the workflow.run() call to where it can actually execute — inside the work session.

### Option C: Infrastructure-level workflow wrapping — BEST but requires code change
Add a `workflow` parameter to `agents.fork()` so the infrastructure automatically wraps the session in a workflow. This would require changes to `manager.ts` but would guarantee structural enforcement per KE-007.

## 5. Recommended Heartbeat Edit

The edit adds a workflow prefix to the fork task template pattern in Step 3. It does NOT restructure the heartbeat steps (KE-008 safe).

### What to add in Step 3 DISPATCH section:

After the workflow routing table, add a **Fork Template** that includes workflow routing in the task text:

```markdown
### Fork Template — Always include workflow routing

When forking work sessions, prepend the workflow instruction to the task:

agents.fork("⚡ WORKFLOW REQUIRED: Call workflow.run('<workflow-name>', '<your-task>') as your FIRST action.\n\n[WORK SESSION] <your task description>")

Map work types to workflows:
- EXP-XXX phases → growth-cycle
- Written findings/analysis → verify-wrap  
- Multi-question research → parallel-research
- Bug investigations → investigate-and-fix
```

## 6. System-Wide Measurement Correction

The workflow adoption metric should be re-baselined:
- **Stop using**: task-text mentions of workflow names (inflated proxy)
- **Use instead**: `workflowRunId IS NOT NULL AND workflowRunId != ''` from sessions table
- **Current real baseline**: 6.7% system-wide (Apr 13)

This means the "plateau at 75%" is actually a plateau at ~7%. The adoption story is completely different from what we thought.

## 7. Impact Estimate

If the fork-template fix works:
- Coach work sessions: 58 sessions/48h → could move from 2% to ~60-70% adoption
- At 32.7 avg ops per work session, structured workflow phases could reduce this by 20-30%
- Expected op savings: ~500 ops/48h from coach alone

## Key Insight

**The heartbeat was telling coach to use workflows, and coach was writing "workflow" in its task descriptions — creating the illusion of adoption.** But the actual `workflow.run()` tool was never called because doing so from a heartbeat would violate the op budget. This is a structural design flaw, not a behavioral one.

---

*Related findings: finding-workflow-health-0414.md, finding-workflow-tracking-fix-0407.md*
