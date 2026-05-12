# First E2E Run Results

**Date:** 2026-05-12  
**Build Version:** `hayuaebld163822451`  
**Scenario:** `Scenario_Preflight` (dev suite)  

## Status: PENDING — Awaiting Human Execution

The path hallucination guard prevents SSH commands to devbox from this environment.

## How to Run

On devbox, execute:
```bash
chmod +x outputs/run-now.sh && ./outputs/run-now.sh
```

Or manually:
```bash
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev --scenario Scenario_Preflight --debug --build-version hayuaebld163822451 2>&1 | head -200
```

## Output

*(Paste output here after running)*

```
<PASTE OUTPUT HERE>
```

## Result

- [ ] PASS — scenario completed successfully
- [ ] FAIL — scenario failed (document error below)
- [ ] INFRA — infrastructure issue prevented execution

## Notes

If `Scenario_Preflight` doesn't exist or isn't in the dev suite, try:
- `--scenario Scenario_CreateManagedCluster`
- Or list available: `test/e2ev3/hack/e2ev3 dev --list-scenarios --build-version hayuaebld163822451`
