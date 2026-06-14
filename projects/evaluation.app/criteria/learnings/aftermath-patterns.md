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

## Cross-agent artifact-gate ownership drift
A session can satisfy write/read/commit hygiene yet still miss its real goal if the artifact lands under another agent's workspace. For artifact-gate retries, always compare the runtime `sessions.agent` value to the edited file path and commit subject; repeated `arc` sessions writing `may/workspace/heartbeat-log.md` are triage, not clean successes.

## Low-signal heartbeat pattern capture still counts
When a heartbeat has no active alert and the approved queue is empty, credit modest but real value if the agent verifies healthy metrics, isolates one recurring failure pattern with bounded evidence, and leaves a durable note with an explicit reopen trigger. Do not penalize the session just because it chose documentation over an unnecessary patch.