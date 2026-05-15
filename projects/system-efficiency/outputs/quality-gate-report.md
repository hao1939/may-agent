# Quality Gate Report

## Script Created
`scripts/quality-gate.sh` — unified quality gate combining:
1. Test gate (all tests must pass)
2. Quality scores (no workflow file below 60/100)
3. TypeScript strict check (errors must not exceed 86 baseline)

## Usage
```bash
cd /app/agents/shared
./scripts/quality-gate.sh
```

## Expected Output
```
=== Running Test Gate ===
✅ Tests: PASS

=== Running Quality Scores ===
✅ Quality Scores: PASS (all ≥60)

=== Running TypeScript Strict Check ===
✅ TypeScript: PASS (N errors, baseline: 86)

================================
🟢 QUALITY GATE: PASS
```

## Exit Codes
- `0` — All checks pass
- `1` — One or more checks failed
