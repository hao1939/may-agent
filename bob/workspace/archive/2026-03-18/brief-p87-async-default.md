# Design Brief: Formalize P87 Async Default & Fix Tech-Lead

## Problem
L3 Metrics (2026-03-26) reveal systemic failure in synchronous coordination:
1.  **Bob->Tech-Lead (22% success)**: 2/9 success. 140s+ latency.
2.  **Bob->Optimizer (16% success)**: 1/6 success. 832s latency (timeout).
3.  **Error Signatures**: `stopReason "toolUse" but no tool call content blocks` (6/8 errors) and `Empty response` (1/8).

Current Philosophy encourages `call` for results (P48), but reality shows this is fragile for long-running tasks. We need to shift to `agents.send` (fire-and-forget) as the default for work, and reserve `call` (blocking) only for high-speed queries (< 30s).

## Proposal

### 1. New Principle: P87 Async Default (The "Don't Block" Rule)
**"Send work, Call queries."**
- **The Rule**: If a task takes > 30 seconds (file edits, reasoning, compilation), use `agents.send` (async). Never block the caller on a long-running task.
- **The Mechanism**: `agents.send` appends to `todo.md` and triggers a heartbeat. The receiver works independently.
- **The Receipt**: The receiver writes a completion file/message. The sender checks for it later (polling) or the receiver notifies back.
- **Why**: Decouples failure domains. If Tech-Lead hangs, Bob shouldn't hang.

### 2. Investigation Task: Tech-Lead Fragility
- **Objective**: Determine why Tech-Lead has a 22% success rate.
- **Hypothesis**: Timeouts on long compiles/tests causing proxy truncation.
- **Action**: Assign Evaluator to deeper dive on Tech-Lead logs.

## Assignments

### Tech-Lead
- **Task**: Audit your recent sessions. Look for the `stopReason "toolUse"` errors. Are you crashing? Or is the proxy cutting you off?
- **Output**: `workspace/tech-lead-postmortem.md`.

### Evaluator
- **Task**: Analyze `session.jsonl` for `tech-lead` sessions. Look for the *end* of the sessions. Do they finish gracefully? Or do they truncate?
- **Output**: `workspace/tech-lead-failure-analysis.md`.

### May (Later)
- **Task**: Update `philosophy.md` with P87 after validation.
