# Evaluator metrics — definitions (2026-04-18)

| metric id | fate | direction | target | threshold | how measured |
|---|---|---:|---:|---:|---|
| evaluator.coverage | keep | higher is better | 90% | 80% | DB collector (already implemented) writes `metrics.current`; heartbeat uses floor alerting (`alert_direction='below'`). |
| evaluator.calibration | deactivate | N/A | 0 (placeholder) | null | No collector implemented (current=null); deactivated to avoid noisy heartbeat injection until a real measurement pipeline exists. |
