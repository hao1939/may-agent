# EXP-500 Status Check — 2026-05-10 (Heartbeat)

## Deployment Verification ✅

Confirmed EXP-500 structural pre-read injection in `master-worker.ts` lines 423-448:
- Regex matches edit/update/modify/change/fix/replace/add-to/append patterns
- Searches 3 candidate paths (outputsDir, parent, projectDir)
- Limits to files <50KB, previews first 200 lines
- Injects as `CURRENT FILE STATE (auto-injected for accurate edit)` block
- Logs `[work] EXP-500: Pre-read injected <path> (<lines> lines)`

## Post-Deployment Data

- **Sessions since deployment**: 2
- **Required for measurement**: 50+
- **Estimated measurement date**: ~2026-05-15

## Early Signal (from prior measurement)

| Metric | Baseline | Early Post (n=6) |
|--------|----------|-------------------|
| Session-level clean rate | 52% | 83% (5/6) |
| Edit failure rate | 15.4% | TBD (insufficient data) |

## experiments.jsonl Entries

Already present:
- `exp-500-deployed` — deployment record
- `exp-500-m1` — early signal measurement
- `exp-500-protocol` — measurement protocol reference

## EXP-475 Status

- **Measurement due**: NOW
- **Tech-lead sessions post-deployment**: 0 identifiable
- **Status**: INSUFFICIENT DATA — cannot measure yet
- **Action**: Wait for more tech-lead heartbeats

## Next Actions

1. Re-measure EXP-500 at next heartbeat (~2026-05-12) — check if 50+ sessions accumulated
2. Re-measure EXP-475 when tech-lead sessions are available
3. Both experiments remain DEPLOYED and active
