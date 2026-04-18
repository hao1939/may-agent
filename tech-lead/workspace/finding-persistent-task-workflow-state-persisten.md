# Lens B: Persistent-Task Workflow State Persistence Flow

**Date**: 2026-04-16  
**Target files**: `agents/shared/workflows/persistent-task.ts` (329 LOC), `src/lib/workflow-tool.ts` (859 LOC), `src/lib/persistence.ts` (workflow run section, ~60 LOC)  
**Scope**: End-to-end state save/restore cycle, crash recovery, context handoff

---

## 1. Architecture Overview

The persistent-task workflow uses a **dual-state** persistence model:

| Layer | Storage | Format | Purpose |
|-------|---------|--------|---------|
| **Project file** | Markdown file at `config.projectPath` | Structured markdown with `**Status**`, `**Updated**`, `### Iteration N` blocks | Human-readable dashboard, crash recovery anchor, iteration log |
| **Workflow run** | JSON file at `<persistDir>/workflows/<runId>.json` | `WorkflowRun` JSON with steps array | Engine-level session graph, replay/resume support |
| **Session meta** | `meta.json` per session dir | `PersistedSession` JSON | Individual sub-agent session tracking |

---

## 2. I/O Operations Per Iteration Cycle

### Single worker+review iteration (happy path):

**Reads:**
1. `readProjectFile(config.projectPath)` — top of while loop (line 281, persistent-task.ts)
2. `readProjectFile(config.projectPath)` — re-read before building review prompt (line 315, persistent-task.ts)

**Writes — project file:**
3. `writeProjectFile` — append worker result + update fields (line 300, persistent-task.ts)
4. `writeProjectFile` — append assessment + update timestamp (line 339 or 344, persistent-task.ts)
5. `writeProjectFile` — update status to done/blocked/paused if terminal (lines 349, 354)

**Writes — workflow run JSON:**
6. `saveWorkflowRun(persistDir, run)` — after worker step completes (workflow-tool.ts ~line 365)
7. `saveWorkflowRun(persistDir, run)` — after review step completes (workflow-tool.ts ~line 365, second call)
8. `saveWorkflowRun(persistDir, run)` — on workflow completion/error (workflow-tool.ts ~line 487)

**Writes — session meta.json (per sub-agent call, inside manager.callAgent):**
9. `writeSessionMeta` — worker session start
10. `writeSessionMeta` — worker session end
11. `writeSessionMeta` — reviewer session start
12. `writeSessionMeta` — reviewer session end

**Total per iteration: 2 reads + 10-12 writes = 12-14 I/O ops**

Each `saveWorkflowRun` and `writeSessionMeta` is atomic (write to `.tmp` then `renameSync`), so individual writes are safe. But the project file writes use plain `writeFileSync` (no atomic rename) — see Finding F1.

---

## 3. Crash Recovery Analysis

### Design intent (§4.5 in spec)
> "Persist worker output BEFORE review (crash safety)"
> "On resume, the workflow picks up at the review step."

### Actual implementation (persistent-task.ts lines 268-280):

```typescript
// If there's a pending review (crash recovery §4.5), start with review
let skipWorkerPhase = state.pendingReview;
if (skipWorkerPhase) {
  iteration = state.lastIteration; // re-review this iteration
}
```

**How it works**: On startup, `parseProjectState()` checks if the last iteration block has `**Worker result**:` but no `**Owner assessment**:`. If so, `pendingReview=true` → skip directly to review phase for that iteration.

**What's preserved**: Worker output, iteration number, all prior iterations, goal, status fields.

**What's lost on crash**: Only the owner review of the current iteration (which hadn't happened yet). This is correct — the review is re-run from scratch.

### Recovery gap (F2): Workflow engine resume ≠ persistent-task resume

The workflow-tool.ts `resume` action (line 593) uses `readWorkflowRun()` to load a previous `WorkflowRun`, then replays completed steps via `manager.result(prevStep.sessionId)` (line 341). But **persistent-task.ts has its own independent recovery** via the markdown file. These two recovery mechanisms are uncoordinated:

- `resume` replays the workflow engine's step index (stepCounter)
- persistent-task reads its markdown file to determine where to resume
- If the process crashes after the worker step is saved to both the markdown AND the workflow run JSON, resume will try to replay the worker session from archive, then the persistent-task will also skip the worker phase (double-recovery).

In practice this is benign because the persistent-task loop re-reads the markdown each iteration and self-corrects, but it's unnecessary complexity.

---

## 4. Findings

### F1: Non-atomic project file writes (Severity: Medium)

**Evidence**: `persistent-task.ts` line 91:
```typescript
function writeProjectFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");
}
```

Compare to `saveWorkflowRun` in `persistence.ts` lines 348-353:
```typescript
const tmpPath = filePath + ".tmp";
writeFileSync(tmpPath, JSON.stringify(run, null, 2), "utf-8");
renameSync(tmpPath, filePath);
```

The workflow run uses atomic write-then-rename. The project file does not. A crash during `writeFileSync` could produce a truncated/corrupt markdown file, losing the entire iteration history. This is the most critical state in the system — it's the human-readable dashboard and recovery anchor.

**Recommended fix**: Use write-then-rename pattern for `writeProjectFile`.

### F2: Dual recovery mechanisms (Severity: Low)

**Evidence**: 
- `persistent-task.ts` lines 268-280: markdown-based `pendingReview` recovery
- `workflow-tool.ts` lines 330-358: step-replay via `manager.result(prevStep.sessionId)` in `resume` action

Two independent recovery mechanisms exist. The markdown-based one (in persistent-task.ts) is the primary and correct one. The engine-level replay (in workflow-tool.ts) is designed for generic workflows and doesn't coordinate with persistent-task's markdown state. This isn't a bug — the markdown recovery always self-corrects — but it means the `resume` action's replay logic is wasted work for persistent-task.

### F3: Stale lock window is 30 minutes, not 10 (Severity: Low, doc mismatch)

**Evidence**: `persistent-task.ts` line 255:
```typescript
if (Date.now() - lastUpdated < 30 * 60_000) {
```

The design doc (persistent-task.md line 197) says "10-minute staleness window" but the implementation uses 30 minutes. Doc/code mismatch.

### F4: High I/O per iteration (Severity: Low, informational)

12-14 I/O operations per iteration across three storage layers. The `saveWorkflowRun` call serializes the entire `WorkflowRun` (including ALL prior steps) on each step completion, not just the delta. For a 50-iteration task, step 50's save writes 50 steps worth of JSON. This is O(n²) total I/O across the full task.

**Evidence**: `workflow-tool.ts` line ~365: `run.steps.push(wfStep); if (persistDir) saveWorkflowRun(persistDir, run);` — pushes to array then saves full object.

### F5: Context window erosion across iterations (Severity: Informational)

**Evidence**: `persistent-task.ts` lines 188-210 (`buildWorkerPrompt`): Only the last 3 iterations are included in the worker prompt. The full project file is NOT passed to the worker — only goal + last 3 iteration blocks + last guidance. This is a deliberate design choice (limits context size) but means long-running tasks lose visibility into early iterations.

---

## 5. Non-Findings (things that look concerning but are fine)

- **"Updated" field staleness**: The Updated field is written on every state change, so the heuristic lock in §4.6 works correctly for detecting active runs.
- **Review error handling**: If the owner review errors, it auto-continues with a fallback assessment (line 330), preventing review failures from killing the task.
- **Iteration cap**: The 200-iteration emergency cap pauses (not errors), preserving all state for future resumption.

---

## 6. Severity Summary

| ID | Finding | Severity | Action |
|----|---------|----------|--------|
| F1 | Non-atomic project file writes | **Medium** | Fix: add write-then-rename to `writeProjectFile` |
| F2 | Dual uncoordinated recovery mechanisms | Low | Document; no fix needed |
| F3 | Stale lock window doc mismatch (10m vs 30m) | Low | Update doc or code to match |
| F4 | O(n²) I/O from full-object saves | Low | Consider delta-only persistence for long tasks |
| F5 | Worker only sees last 3 iterations | Info | By design; note in operational docs |
