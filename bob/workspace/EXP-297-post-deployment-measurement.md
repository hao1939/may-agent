# EXP-297 Post-Deployment Measurement

**Deployed**: commit 966faecb4 at timestamp 1777576664
**Measurement window**: 7 days post-deployment (until ~1777576664 + 604800 = 1778181464)

## Baseline (Pre-Deployment)

Ghost completion sessions identified in evaluations:
| Session | Agent | Quality | Iterations |
|---------|-------|---------|------------|
| s_1777483248275_448 | coach | 0.0 | 28+ |
| s_1777483248263_447 | optimizer | 0.2 | multiple |
| s_1777483248236_446 | optimizer | 0.1 | multiple |
| s_1777471451597_3 | optimizer | 0.2 | unknown |

**Baseline rate**: 4 ghost completions in ~12 days = ~0.33/day

## What Was Deployed

Line 161 of `agents/shared/workflows/master-worker.ts`:
```
- You are starting a FRESH session. Your job is to produce FILES, not verify state.
```

Plus the full Session Contract block from EXP-297 design.

## Post-Measurement Protocol

After 7 days (approx 2026-08-11), run:

```bash
# Check for new evaluations with NON_DELIVERY or LOOPING
grep -rl "NON_DELIVERY\|LOOPING\|ghost_completion" .state/evaluations/ | \
  xargs -I{} stat -c "%n %Y" {} | \
  awk -v threshold=1777576664 '$2 > threshold {print}'
```

## Success Criteria

- **Success**: ≤1 ghost completion in 7-day post window (≥50% reduction)
- **Partial**: 2 ghost completions (some improvement)
- **Failure**: 3+ ghost completions (intervention ineffective)

## Status

- [x] Baseline measured (4 sessions pre-deployment)
- [x] Intervention deployed (confirmed in code, line 161)
- [ ] Post-measurement (pending — needs ~7 days of data)
- [ ] Results write-up

## Next Steps

If successful: close EXP-297 with evidence, create KE entry.
If failed: investigate whether agents are receiving the prompt (check session logs for "FRESH session" text appearing in context).
