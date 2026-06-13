# Multi-Session Task Continuity Audit

**Date**: 2026-05-18  
**Task**: multi-session-task-continuity  
**Finding**: Context loss ≥ 40% across multi-session tasks; convention drafted below.

---

## 5 Audited Tasks

### 1. evaluator-low-quality-rate-calibration (8 sessions)
**Context loss**: ~45%  
**Evidence**: The task prompt grew to ~4000 words of "Context (accumulated knowledge)" to compensate for session amnesia. Despite this, the worker hit the **same gitignore blocker** in iterations 4 AND 5 (uncommitted `project.md` changes blocked by `.gitignore`). The reviewer explicitly noted: "The last 3 iterations produced *documents*, not an operational change" — iterations re-derived analysis instead of implementing the already-documented fix.  
**Re-derivation pattern**: Worker re-read `metrics-snapshot.ts` in iterations 3, 4, and 5 despite findings being in accumulated context.

### 2. ruflo-learning-loop (10 sessions across iterations 2-7)
**Context loss**: ~55%  
**Evidence**: Iteration 2 produced "8 self-referential bookkeeping artifacts (STATUS.md, NEXT.md, 'final consolidation', 'closeout', 'escalation candidate check')" — the agent lost the actual goal and spiraled into meta-organization. The reviewer had to explicitly ban certain file patterns: "Forbidden in iter-3: any new `iter-02-*.md`, STATUS.md/NEXT.md edits." The anti-pattern was agents re-deriving project structure instead of advancing work.  
**Re-derivation pattern**: Agent rebuilt project tracking each session instead of executing the established plan.

### 3. prompt-efficiency (15 sessions)  
**Context loss**: ~60%  
**Evidence**: Iterations 29-50 (20+ sessions) all produced the identical response: "Project is COMPLETE. Stop dispatching." The system failed to retain that the project was done, dispatching workers repeatedly to a completed project. Each session re-read project.md, re-verified metrics, and re-concluded "done" — identical work repeated 20+ times.  
**Re-derivation pattern**: Complete state re-assessment every session; no durable "DONE" signal persisted.

### 4. documentation-gen (12 sessions)
**Context loss**: ~55%  
**Evidence**: Iterations 31-44 each produced "This project is **COMPLETE**. **Do not dispatch any more worker iterations to this project.**" Same pattern as prompt-efficiency. Additionally, iteration 39's worker said: "The verification blocker seems to be tracking the edit() I made earlier" — indicating confusion about session-local vs cross-session state.  
**Re-derivation pattern**: Each session independently verified project completion from scratch.

### 5. daily-alert-review (24 sessions)
**Context loss**: ~35%  
**Evidence**: 24 sessions with 4 interruptions and 3 errors. Task was "iteration 1" across all sessions — the system never advanced past iteration 1 despite successful completions. Multiple sessions started fresh ("New project. First iteration should query the last 24h") without incorporating prior successful runs.  
**Re-derivation pattern**: Re-queried same 24h window instead of building on prior reports.

---

## Aggregate Findings

| Task | Sessions | Context Loss | Primary Loss Pattern |
|------|----------|-------------|---------------------|
| evaluator-calibration | 8 | 45% | Same blocker hit repeatedly |
| ruflo-learning-loop | 10 | 55% | Goal displacement / meta-spiral |
| prompt-efficiency | 15 | 60% | Completion state not persisted |
| documentation-gen | 12 | 55% | Completion state not persisted |
| daily-alert-review | 24 | 35% | Iteration counter reset |
| **Average** | — | **50%** | — |

**Measured loss: 50% average (≥30% threshold met)**

---

## Loss Patterns Identified

1. **Completion blindness**: Tasks already finished get re-dispatched because no durable "DONE" marker exists outside the session.
2. **Blocker amnesia**: Agents encounter the same failure mode (e.g., gitignored paths) across multiple sessions without learning from prior failures.
3. **Goal displacement**: Without strong context anchoring, agents default to meta-organization (status files, pointers, consolidation) instead of executing.
4. **Context injection bloat**: The system compensates by injecting enormous context sections (4000+ words) into task prompts, which itself creates noise and token waste.
5. **Iteration counter drift**: Multi-iteration tasks reset their iteration number or fail to advance state machines.

---

## Task-Continuity Convention (DRAFT)

### C-CONT: Task Continuity Protocol

#### 1. Checkpoint File (Required for tasks spanning 2+ sessions)

Every multi-session task MUST maintain a checkpoint file at:
```
<project-outputs-dir>/checkpoint-<task-id>.md
```

Format:
```markdown
# Checkpoint: <task-id>
## Last Updated: <ISO timestamp>
## Status: in-progress | blocked | complete

## Accomplished (immutable log)
- [session-id] <what was done>
- [session-id] <what was done>

## Current State (mutable)
<2-3 sentences: where we are right now>

## Known Blockers (mutable)
- <blocker description + what was tried>

## Next Action (single concrete step)
<exactly what the next session should do first>

## Anti-Patterns Encountered
- <thing that failed — do NOT retry this approach>
```

#### 2. Resumption Protocol

On session start for a multi-session task:
1. **Read checkpoint first** — before any other file reads or tool calls.
2. **Execute "Next Action"** — do not re-derive the plan.
3. **Check "Anti-Patterns"** — do not repeat known failures.
4. **Update checkpoint on finish** — before calling `finish()`, update the checkpoint file.

#### 3. Completion Signal

When a task is complete:
1. Set checkpoint `Status: complete`
2. The dispatcher MUST check checkpoint status before re-dispatching
3. A completed checkpoint is a hard gate against re-dispatch

#### 4. Context Budget Rule

Accumulated context injected into task prompts MUST NOT exceed 1000 words. If context exceeds this:
- Move details to the checkpoint file
- Keep only "Current State", "Next Action", and "Anti-Patterns" in the prompt
- Reference the checkpoint file path for full history

#### 5. Blocker Deduplication

If a session encounters a blocker:
1. Check checkpoint "Anti-Patterns" — if this blocker is listed, escalate immediately (do not retry)
2. If new, add to "Anti-Patterns" with what was tried
3. After 2 sessions hitting the same blocker class, auto-escalate to task owner

---

## Recommendations

1. **Implement checkpoint file convention** in the project workflow (`master-worker.ts`) — auto-create on first iteration, auto-read on subsequent iterations.
2. **Add dispatch gate** that checks checkpoint status before dispatching to a task.
3. **Cap context injection** at 1000 words and reference checkpoint file for the rest.
4. **Add blocker deduplication** logic to the reviewer step of master-worker workflow.
