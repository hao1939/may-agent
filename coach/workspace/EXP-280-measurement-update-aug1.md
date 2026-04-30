# EXP-280: Measurement Update — Aug 1, 2026

**Status**: INCONCLUSIVE — insufficient post-treatment separation

## Data Collected

### Post-Deployment Window (Apr 30 midday onward, n=14)
| Metric | Value |
|--------|-------|
| FM-3.3 rate | **50%** (7/14) |
| Avg quality | 0.709 |
| VERIFICATION issues | 29% (4/14) |

### Baseline (pre-deployment, n=15)
| Metric | Value |
|--------|-------|
| FM-3.3 rate | **53%** (8/15) |
| Avg quality | 0.691 |

## Analysis

**Delta: FM-3.3 dropped 3pp (53% → 50%) — NOT significant.**

The treatment (hard-rule skill + heartbeat enforcement for verify-after-edit) shows no meaningful effect on FM-3.3 rate. Quality improved marginally (+0.018) but within noise.

### Why No Effect?
1. **Timing**: All evaluations are from Apr 30 — the same day as deployment. Agent may not have internalized the rule yet.
2. **Nature of FM-3.3**: Many flagged sessions show the *finish guard* blocking (then agent recovers) — this means the guard WORKS but the agent doesn't proactively verify, only reactively when blocked.
3. **Text coaching ceiling**: Consistent with KE-338 — text-based interventions don't durably change behavior. The finish guard (structural) is doing the heavy lifting, not the skill text.

## Decision (per matrix)

| FM-3.3 rate | Quality | Matrix says |
|-------------|---------|-------------|
| 50% (>20%) | 0.709 (≥0.70) | **FAIL — escalate to infrastructure enforcement** |

## Conclusion

EXP-280 result: **NEGATIVE** (text skill has no incremental effect beyond existing finish guard).

The finish guard already forces verification recovery. Adding a text skill saying "always read() after edit()" does not reduce the FM-3.3 trigger rate — agents still attempt to skip verification until structurally blocked.

## Next Steps
1. Close EXP-280 as NEGATIVE
2. Update KE-338 with this additional confirmation
3. The actual fix is the existing finish guard (structural) — it catches 100% of verification failures reactively
4. Proactive compliance would require a tool-layer gate (auto-inject read() after every edit/write)

## Implications for EXP-275 (Optimizer Quality)
Same treatment deployed to optimizer. If optimizer shows similar results (no FM-3.3 reduction from text), confirms text coaching is dead for verification behavior universally.
