# Heartbeat investigation — metrics doc/code divergence + missing session.error-rate-6h

Date: 2026-05-01
Owner: dev

## Signal / trigger
The Dev Heartbeat checklist requires checking `session.error-rate-6h` and other core health metrics.

## What I found
`agents/may/handlers/metrics-snapshot.ts` contains an explicit header comment noting **doc-code divergence**:
- Design doc `agents/shared/may-agent-docs/design/agent-metrics.md` defines 6 system metrics, including:
  - `session.error-rate-6h` (6h sessions error+interrupted / total)
  - `system.real-output-24h` (git-based output)
- The handler currently auto-registers/measures **12 metrics**, but **does not measure** the two above.

So even if the heartbeat assumes these metrics exist, the system won’t produce them via the snapshot handler.

## Impact
- Operators are instructed (by heartbeat docs) to watch a metric that is not being measured.
- Missing `session.error-rate-6h` means we may miss systemic failures in sessions (distinct from handler failures).
- Missing `system.real-output-24h` removes the key “are we producing?” output signal.

## Root cause
Implementation drift:
- The design doc was updated/approved (2026-04-30), but the metrics-snapshot handler wasn’t updated to include all 6 designed system metrics.

## Proposed fix
Update `agents/may/handlers/metrics-snapshot.ts` to:
1) Add `session.error-rate-6h` measurement (from `sessions` table).
2) Add `system.real-output-24h` measurement via `source_command` (git log + diff stat scoped to substantive files).
   - Or implement directly in the handler using `child_process.execSync`.

Also consider:
- Either update the doc to include the 12 metrics currently measured, or split into “core 6” + “extra helpful” to avoid future confusion.

## Evidence
- File: `agents/may/handlers/metrics-snapshot.ts` header comment + ALL_METRICS list.
- File: `agents/shared/may-agent-docs/design/agent-metrics.md` lists the 6 metrics and explicitly says all are measurable today.
