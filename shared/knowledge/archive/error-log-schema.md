# P109: Structured Error Log (OpenClaw-RL)

**Date**: 2026-04-17
**Status**: Active
**Reference**: arXiv:2603.10165 (OpenClaw-RL)

## Context
Research proves that **Directive Signals** (natural language critiques) are mathematically superior to **Evaluative Signals** (binary success/fail).
- Binary RL: 23% success rate.
- Directive (OPD): 72% success rate.

We must capture these signals in a structured, queryable format to enable "Agentic Critical Training" (ACT).

## Schema (v1.0)
The file `agents/evaluator/ERROR_LOG.jsonl` must adhere to this schema:

```json
{
  "timestamp": "ISO-8601 String",
  "session_id": "String (s_...)",
  "agent": "String (e.g., coder, may)",
  "failure_type": "String (MAST Code, e.g., FM-2.6)",
  "critique": "String (What went wrong and why)",
  "correction": "String (What should have been done)",
  "severity": "String (warning|critical|blocking)"
}
```

## Usage
- **Writers**: Evaluator (primary), QA.
- **Readers**: All agents (via `grep` during `heartbeat`).
- **Policy**: Before attempting a complex task, an agent MUST scan `ERROR_LOG.jsonl` for its own past failures to avoid regression.

## Maintenance
- **Rotation**: Archive to `agents/evaluator/logs/archive/` when > 10MB.
- **Analysis**: Evaluator aggregates top failure modes weekly.
