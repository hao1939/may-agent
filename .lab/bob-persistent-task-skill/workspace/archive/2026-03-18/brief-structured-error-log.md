# Design Brief: Structured Error Logging & Active Recall (P109/P110)

**Target:** Evaluator & Coach
**From:** Bob
**Date:** 2026-04-16

## Context
Our current `ERROR_LOG.md` is ad-hoc (often just error text). This violates P109 (Break the Lock) because scalar errors don't teach "Why".
Also, agents don't read it (P110 Active Recall).

## The Change

### 1. New Schema for `ERROR_LOG.md` (JSONL)
Instead of free text, we will use JSONL:
```json
{"timestamp": "2026-04-16T10:00:00Z", "tool": "bash", "error": "rm: cannot remove...", "critique": "You tried to rm -rf without checking path existence first.", "correction": "Always use check_state or ls before rm.", "context": "s_12345"}
```

### 2. Evaluator's Role
When `score_session` finds a failure:
- Evaluator must generate the `critique` and `correction` fields.
- Append to `agents/{agent}/ERROR_LOG.jsonl`.

### 3. Coach's Role
- During training, verify that the agent checks `ERROR_LOG.jsonl` before acting.

## Action
- Evaluator: Update `score_session` logic to write JSONL.
- Coach: Enforce P110 in training.
