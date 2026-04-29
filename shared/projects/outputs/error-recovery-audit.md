# Error Recovery Audit — Agent Workflow System

## Overview
Audit of `/app/agents/shared/workflows/` identifying failure modes where work is lost due to crashes, provider errors, or missing persistence.

**Files reviewed**: master-worker.ts, project.ts, workflow-runner.ts, retry-wrapper.ts, circuit-breaker.ts

---

## Top 3 Failure Modes

### 1. Mid-Iteration Crash Loses All Progress (Severity: HIGH)

**Affected file**: `master-worker.ts` (lines 250–400), `project.ts`

**Problem**: If the process crashes between a worker completing work and the orchestrator reviewing it, the journal entry is never written. The iteration's output files exist on disk but are not recorded anywhere — the next run re-does the iteration or skips it entirely.

- Worker output (`worker.lastText()`) is only captured after the prompt completes
- Journal append happens AFTER the review phase, not after work phase
- No intermediate checkpoint between work and review phases

**Evidence**: Journal entries are appended at review time (line ~460 in master-worker.ts). A crash between work completion and review = lost record of what happened.

**Recommended fix**: 
1. Write a `.state/iteration-in-progress.json` checkpoint immediately after worker produces output
2. On startup, check for incomplete iterations and resume from the checkpoint
3. Append a partial journal entry after work phase ("work complete, pending review")

---

### 2. Orchestrator Provider Error After Worker Success (Severity: HIGH)

**Affected file**: `master-worker.ts` (lines 420–450)

**Problem**: The review phase retries orchestrator prompts 3 times with basic backoff, but if all 3 fail (provider outage), the entire workflow throws an unhandled exception. The worker's completed work for that iteration is lost from the journal — files exist but no record of what was done or what to do next.

**Evidence**: 
```typescript
while (reviewAttempt < 3) {
  try { await orchestrator.prompt(reviewPrompt); break; }
  catch (e: any) {
    reviewAttempt++;
    if (reviewAttempt >= 3) throw e;  // ← unhandled, bubbles up
  }
}
```

**Recommended fix**:
1. Before throwing after 3 failures, write a recovery checkpoint with worker output and iteration state
2. On next workflow start, detect the checkpoint and feed the saved worker output to a fresh orchestrator review
3. Consider using the retry-wrapper.ts (already exists!) instead of ad-hoc retry logic

---

### 3. Project.ts Has No Crash Recovery for Single-File (Legacy) Format (Severity: MEDIUM)

**Affected file**: `project.ts` (lines 77–81, 174–181, 290–294)

**Problem**: In legacy single-file mode, `projectContent` is held in memory and written back periodically. A crash means all in-memory state changes since last write are lost. The code has many `try {} catch {}` blocks that silently swallow errors — file permission issues, disk full, or corrupted state are never surfaced.

**Evidence**: Multiple empty catch blocks: `} catch { /* file may not exist yet */ }`, `} catch { return projectContent; }`, `} catch { /* ignore */ }`. These hide real failures.

**Recommended fix**:
1. Write-through on every mutation (or at minimum every iteration boundary)
2. Log swallowed errors to a debug file so failures are at least visible
3. Add fsync/flush after critical writes to prevent partial-write corruption

---

## Additional Observations

### Positive: Existing Mitigations
- **Circuit breaker** (`circuit-breaker.ts`): Properly tracks consecutive failures per agent, trips after 3, generates SIGNAL files for human attention
- **Retry wrapper** (`retry-wrapper.ts`): Exponential backoff with jitter, circuit breaker integration — but only used in `workflow-runner.ts`, NOT in `master-worker.ts`
- **Budget checkpoint** (`budget-checkpoint.ts`): Prevents runaway spending — good operational protection
- **Zero-output guardrails** (master-worker.ts V2/V3): Auto-retry and escalation for worker failures — handles the common case well

### Gap: retry-wrapper.ts Not Used in Master-Worker
The retry-wrapper exists and is well-designed but master-worker.ts uses its own ad-hoc 3-attempt loop for orchestrator prompts. The worker phase has NO retry at all — a single provider error kills the iteration.

### Gap: No State Persistence Between Workflow Restarts  
If the entire Node process is killed (OOM, deployment, timeout), there's no way to resume mid-iteration. The workflow always restarts from the top of the loop, relying on the journal to determine which iteration to start at. But if the journal wasn't updated...

---

## Summary Table

| # | Failure Mode | File | Severity | Fix Effort |
|---|---|---|---|---|
| 1 | Mid-iteration crash loses progress | master-worker.ts | HIGH | Medium (add checkpoint file) |
| 2 | Orchestrator error after worker success | master-worker.ts | HIGH | Low (save state before throw) |
| 3 | Silent error swallowing in project.ts | project.ts | MEDIUM | Low (add logging) |
| 4 | retry-wrapper not used in master-worker | master-worker.ts | MEDIUM | Low (swap in existing code) |
| 5 | No mid-iteration resume capability | all | LOW | High (requires state machine refactor) |

---

*Generated: Iteration 5, System Efficiency Project*
