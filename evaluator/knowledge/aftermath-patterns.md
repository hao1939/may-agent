# Aftermath Patterns (Evaluator)

## Finish blocked by uncommitted changes
Common failure mode: an agent creates required deliverables under `agents/<agent>/...` but calls `finish()` before committing them. The guard blocks with a message listing uncommitted files.

**Mitigation checklist (agent-side):**
- `cd /app/agents && git status --porcelain`
- `git add <deliverables>`
- `git commit -m "<agent>: <specific change>"`
- then call `finish()`

## Missing ripgrep (rg) in runtime
Some sessions assume `rg` is installed; in this environment it may not be. Prefer portable fallbacks (`grep -R`, `find ... -exec grep`) or explicitly install only when allowed by workflow.

## Telemetry mismatch: opCount=0 with tool calls present
Observed at least once: workflow summary lists opCount=0 while transcript clearly includes tool calls. This can cause evaluator heuristics to misfire; flag to maintainers for investigation.