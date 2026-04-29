# Workflow Guardrails v2 Design

## Context

Guardrails v1 (pre-flight checks, timeout escalation) improved success rate from 33% to ~92% (days 1-6). However, day 7 revealed a new failure mode: **false completion claims** — the worker reports files as written/existing when they weren't. The existing `⚠️ NO files modified` warning was insufficient because it's just appended to worker output for the orchestrator to see, but the orchestrator prompt doesn't enforce action on it.

## New Failure Mode: False Completion Claims

**Pattern**: Worker uses `read()` or `bash()` to check if files exist, interprets partial/old content as complete, and reports "already done" without calling `write()`. This happened 8+ consecutive times.

**Root cause**: No hard enforcement in the workflow loop — the zero-output warning is informational only.

## Proposed Changes to `master-worker.ts`

### 1. Hard Zero-Output Escalation (line ~337)

Current: Warning is appended to orchestrator context as text.

Proposed: After 2 consecutive zero-output iterations, inject a **mandatory override** into the orchestrator prompt:

```typescript
// Track consecutive zero-output iterations
if (changedFiles.length === 0) {
  consecutiveZeroOutput++;
} else {
  consecutiveZeroOutput = 0;
}

// After 2 consecutive zero-output iterations, force escalation
if (consecutiveZeroOutput >= 2) {
  orchestratorContext += `\n\n**SYSTEM ALERT**: ${consecutiveZeroOutput} consecutive iterations produced NO files. Worker may be hallucinating completion. Consider: (1) writing files yourself as orchestrator, (2) providing exact file content in the task, (3) pivoting strategy.`;
}

// After 4 consecutive zero-output iterations, auto-terminate the workflow
if (consecutiveZeroOutput >= 4) {
  orchestratorContext += `\n\n**WORKFLOW TERMINATED**: Too many zero-output iterations. Filing failure report.`;
  break;
}
```

### 2. Write-First Constraint in Worker System Prompt (line ~114)

Add to worker system prompt:
```
CRITICAL: If your task says to write a file, your FIRST tool call must be write(). 
Do NOT read files to "check if they exist" before writing. 
Do NOT claim files "already exist" without the orchestrator explicitly confirming this.
```

### 3. Orchestrator Verification Reminder (line ~78)

Add to orchestrator system prompt:
```
After each worker iteration, if worker claims files were produced, verify with read() or bash(ls) 
before checking off milestones. The ⚠️/✅ output verification line is ground truth — trust it over worker claims.
```

### 4. Iteration Budget per Milestone

Add a per-milestone iteration budget. If a milestone hasn't progressed in 3 iterations, the orchestrator should either write the file directly or skip it.

## Implementation Priority

1. **Write-first constraint in worker prompt** — lowest effort, highest impact
2. **Consecutive zero-output tracking + escalation** — prevents infinite loops
3. **Auto-termination after 4 zero-output** — safety valve
4. **Orchestrator verification reminder** — defense in depth

## Success Criteria

- Zero false completion claims per 7-day period
- 90%+ iteration success rate sustained over 7 days
- No workflow stuck in zero-output loop for >2 iterations
