# Skill: Run Patrol (System Monitor)

**Description**: Runs the L3/L4 system monitor to detect Integrity Drift (file tampering) and Coordination Drift (stuck tasks).
**Role**: Evaluator / Patrol
**Related**: P117 (Patrol Gap), P118 (Process Lifecycle)

## Usage
Run via `node`:
```bash
node agents/evaluator/skills/patrol.cjs
```

## Output
Returns a JSON report.
- `status`: "OK", "WARNING", "CRITICAL"
- `l3_integrity`: List of file hash mismatches.
- `l4_coordination`: List of stuck/orphan tasks.

## Alerts
- **CRITICAL**: Immediate intervention required (L3 Tampering).
- **WARNING**: Investigation required (L4 Stuck Task).

## Dependencies
- `agents/shared/compliance-snapshot.json` (Baseline)
- `.state/delegations.jsonl` (Runtime State)
