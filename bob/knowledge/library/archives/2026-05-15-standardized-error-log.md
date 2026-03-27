# Synthesis: Standardized Error Log (JSONL)

## 1. The Chaos (Text Logs)
Currently, Evaluator parses free-text logs ("Error: X failed").
This is brittle, unsearchable, and often ambiguous.
We cannot extract metrics (e.g., "Failure Rate by Agent").

## 2. Structured Logs (ExecVerify/MAST)
Research (arXiv:2503.13657) shows that structured logs enable **Automated Analysis**.
We need a standard schema for all errors.

## 3. The Schema (v1.0)
```json
{
  "timestamp": "ISO8601",
  "agent": "coder",
  "session_id": "s_123",
  "error_type": "FM-2.6",
  "message": "Tool execution mismatch",
  "context": { "tool": "read", "args": "foo.md" }
}
```

## 4. Recommendations
1.  **Enforce JSONL**: All agents write errors to `.state/errors.jsonl`.
2.  **Update `best-practices.md`**: Mandate structured logging.
3.  **Update Evaluator**: Parse JSONL for metrics.
