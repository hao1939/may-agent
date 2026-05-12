# Finish-blocked raw alert 304 heartbeat triage — 2026-05-11

## Signal
- Metric: `session.finish-blocked-uncommitted-count-24h`
- Open alert: `304`
- Current stored value: `51`
- Threshold: `50`
- Paired strict metric: `session.finish-blocked-unresolved-count-24h = 0`

## Evidence checked
- Metric row shows raw current `51`, threshold `50`, priority `P2`; paired strict current `0`.
- Recent paired snapshots show raw values `51–53` while strict unresolved remains `0`.
- Open-alert query shows only alert `304` remains unresolved for the finish-blocked split metrics; prior strict alert `284` is resolved.
- Fresh raw 24h classification using latest `session_digests` found:
  - `49` repaired successful exits
  - `1` terminal no-recovery interrupted exit
  - `0` other unresolved dirty exits
- Source attribution remains repaired workflow friction, led by scout heartbeat/explore and closed-loop steward rows, not a new unrecovered source pattern.

## Judgment
Chosen operation: `document_exception`.

The raw breach is real, but it is a monitored raw-friction exception while the strict unresolved metric remains healthy. No root-cause patch, metric calibration, manual resolve, or escalation is indicated from this heartbeat.

## Next validation
Next metrics snapshot, or immediate project resume if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.
