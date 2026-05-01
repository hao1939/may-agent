# Investigation: tools mismatch (heartbeat suggests query_db but dev toolset lacks it)

Date: 2026-05-01
Owner: dev

## Signal
Heartbeat instructions in `agents/dev/heartbeat.md` direct using `query_db` to check session failures and metrics.

## Observation / Evidence
- Dev agent toolset (per SOUL — Dev system instructions) includes only: `read`, `bash`, `edit`, `write`, `finish`.
- Attempting to follow heartbeat would require `query_db` (not available), so the agent cannot execute the SQL queries.

## Impact
- Heartbeats can’t be completed as designed (no ability to check error metrics, recent failures, handler errors).
- This delays detecting and fixing infra regressions.

## Root cause hypothesis
Tooling mismatch: heartbeat template was copied from an agent profile with DB access, but dev agent profile here does not include `query_db`.

## Proposed fixes
1. **Update `agents/dev/heartbeat.md`** to use file-based investigation paths available with current tools (e.g., inspect `agents/**/workspace/investigations`, grep logs under `agents/**/workspace`, or check metrics snapshots if stored as files).
2. **Or** grant `query_db` tool to dev agent (requires owner/system change outside this repo).
3. Add a guard/metric that detects heartbeats referencing unavailable tools.

## Next steps
- Search for where metrics/sessions DB lives and whether there’s a file-based API accessible via scripts.
- Patch heartbeat.md to include a fallback path that works with `bash`/`read`.
