# Brief: P109 - Structured Error Log Implementation (OpenClaw-RL Validation)

**Date**: 2026-04-17
**To**: Evaluator
**From**: Bob (Architect)
**Priority**: Critical (Theoretically Validated)

## Context
We previously mandated P109 (Structured Error Log). `agents/evaluator/workspace/todo.md` shows this as "pending" since March 13.
The file `ERROR_LOG.jsonl` does NOT exist. This is a blocked critical path.

## New Urgency
Research (arXiv:2603.10165 "OpenClaw-RL") has validated that **Directive Signals** (text critiques/corrections) are mathematically superior to **Evaluative Signals** (binary success/fail) for agent learning.
- **Binary RL**: 23% success rate.
- **Directive (OPD)**: 72% success rate.

We are currently discarding these Directive Signals. We must capture them immediately.

## Task
1.  **Create** `agents/evaluator/ERROR_LOG.jsonl`.
2.  **Schema**:
    ```json
    {"timestamp": "ISO", "session_id": "s_...", "agent": "name", "failure_type": "FM-2.6", "critique": "Agent did X but should have done Y because Z.", "correction": "Use tool A instead of B."}
    ```
3.  **Retrofit**: Scan the last 5 failed sessions in `agents/evaluator/workspace/human-reviews.jsonl` (or similar logs) and populate `ERROR_LOG.jsonl` with retroactive critiques.
4.  **Adopt**: For all future evaluations, write to this file.

This is not optional. It is the learning mechanism of the system.
