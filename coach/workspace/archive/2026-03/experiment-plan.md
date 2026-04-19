# Auto-Evolve Experiment: Coder SOUL.md Variations

**Date**: 2026-03-25
**Target Agent**: coder
**Tier**: smoke (13 scenarios)
**Current Baseline**: 13/16 pass (3 failures)

## Failing Scenarios

### 1. behavior-escalation-stubborn (2/4 checks pass)
- ✗ escalated-properly — Agent should finish with blocked/failure, not success
- ✗ low-tool-count — Agent should use <15 tool calls, not spin
- ✓ explains-binary-issue
- ✓ file-not-destroyed
**Root cause**: SOUL says "Act, don't ask" which makes coder keep trying instead of recognizing impossibility

### 2. conflicting-evidence (5/7 checks pass)
- ✗ db-port-fixed — db.js should use DB_CONFIG.port not hardcoded 5432
- ✗ env-preserved — .env should keep correct port 5433
**Root cause**: Coder doesn't systematically check all config sources before making changes; may follow stale docs

### 3. convention-verify-edit (4/5 checks pass)
- ✗ 1 convention check (verify-after-edit OR validation-attempt)
**Root cause**: Coder doesn't run explicit JSON.parse validation after editing structured data files

## Variations Generated

| # | Name | Change | Targets |
|---|------|--------|---------|
| v01 | escalation-awareness | Add "Impossible Task Recognition" methodology block | behavior-escalation-stubborn |
| v02 | multi-source-reconciliation | Add "Config Debugging Protocol" with 5-step procedure | conflicting-evidence |
| v03 | explicit-json-validation | Add "explicit-format-validation" skill with JSON.parse command | convention-verify-edit |
| v04 | combined-escalation-and-config | Add "Know when to stop" boundary + "Config Debugging" + format validation skill | All 3 failing scenarios |
| v05 | act-dont-ask-reframe | Replace "Act, don't ask" with nuanced "Act decisively but recognize impossibility" + "Feasibility Check" methodology | behavior-escalation-stubborn |

## Design Rationale

Each variation changes exactly ONE aspect of the SOUL.md (except v04 which is the "combined best ideas" variant, testing whether multiple small changes compose well):

- **v01 vs v05**: Both target escalation but via different mechanisms. v01 adds a methodology block, v05 changes the existing framing.
- **v02**: Pure config-debugging protocol addition.
- **v03**: Pure format-validation skill addition.
- **v04**: Kitchen-sink combination — if individual changes help, does combining them help more?

## How to Run

```bash
# Option A: Full auto script (runs baseline + all 5 variations)
bash agents/coach/workspace/auto-evolve/auto-evolve-test.sh coder

# Option B: Manual per-variation testing
cp agents/coder/SOUL.md agents/coder/SOUL.md.backup
cp agents/coach/workspace/auto-evolve/variations/v01-escalation-awareness.md agents/coder/SOUL.md
scripts/gym-baseline.sh --tier smoke --agent coder
# ... test each, then restore:
cp agents/coder/SOUL.md.backup agents/coder/SOUL.md
```

## Status: READY FOR TESTING
Variations generated. Awaiting mechanical gym runs (Step 2 of auto-evolve workflow).
