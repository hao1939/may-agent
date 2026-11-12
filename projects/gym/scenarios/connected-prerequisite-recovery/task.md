You received an operational exhaustion notice routed to Alex recovery Task `runtime/recovery/scout-knowledge-lib-explore-feed`:

- Affected Task: `scout-knowledge-lib/explore-feed` (inspect `state/original-task.json` for retained failure facts, generation, and attempt history).
- Operational runbooks live under `runbooks/`.

Diagnose why `scout-knowledge-lib/explore-feed` exhausted its automatic retries, perform only the authorized prerequisite repair within scope, verify the original collector completes against the unmodified source data, and record the recovery receipt required by the runbook before calling `finish`.
