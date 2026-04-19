# Finding: Tool Quality "Regressions" Are Noise — No Action Needed

**Date**: 2026-04-10  
**Severity**: P3 (informational)  
**Category**: Tool quality monitoring  

## Summary

The tool-quality-scan flagged two regressions: `read:other` (2→4, +100%) and `bash:nonexistent-path` (4→6, +50%). Investigation shows these are **statistical noise within a strongly improving trend**, not real regressions. All incidents are bob, and both categories represent tiny absolute numbers against 11,403 total calls.

## Analysis

### read:other (2→4, +100%)
- **What happened**: Bob read `agents/shared/knowledge/INDEX.md` with stale offset values (e.g., offset 607 when file was 604 lines, offset 695 when file was 688 lines)
- **Root cause**: INDEX.md changes length frequently as bob adds/removes entries. Bob's heartbeats use hardcoded or cached offsets from previous reads
- **Impact**: 4 wasted calls total — 0.04% of all calls
- **Verdict**: Normal noise. The "100% regression" is just 2→4 in absolute terms

### bash:nonexistent-path (4→6, +50%)
- **What happened**: Bob tried to `ls agents/shared/knowledge/library/topic-index/` (doesn't exist) and `wc -l` on a specific topic file with wrong path
- **Root cause**: Bob assumes knowledge library directory structures that were renamed/reorganized. `topic-index/` doesn't exist; the actual directory is `topics/`
- **Impact**: 6 incidents, 30 wasted calls — but the **long-term trend is massively improving**: 33→33→27→17→4→6
- **Verdict**: Noise. Down 82% from peak of 33. The +50% flag is a scan-to-scan fluctuation, not a trend reversal

## Context: Everything Is Improving

| Metric | 2 days ago | Now | Change |
|--------|-----------|-----|--------|
| Waste rate | 5.3% | 2.6% | -51% ↓ |
| Total wasted | 598 | 301 | -50% ↓ |
| bash:nonexistent-path | 33 | 6 | -82% ↓ |
| Sessions with failures | 32 | 32 | stable |

The regression detector fires at >20% scan-over-scan increase, which is correct for catching real problems but will inevitably flag noise when counts are low (2→4 is +100% but meaningless).

## Related Finding

Bob's INDEX.md reading pattern is already documented in `finding-bob-heartbeat-overhead-0410.md`, which proposes removing the INDEX.md skim from heartbeats. If implemented, the `read:other` category would drop to near-zero.

## Recommendation

**No action needed.** Specifically:

1. **Do not create a fix** — the numbers are too small to warrant structural changes
2. **The existing bob heartbeat overhead fix** (remove INDEX.md skim) will naturally address the `read:other` category
3. **Consider adding a minimum-count threshold** to the regression detector (e.g., only flag if count ≥ 8 AND delta > 20%) to avoid future noise alerts on tiny absolute numbers

### Optional scan improvement
In `tool-quality-scan.ts`, the regression check could be tightened:
```typescript
// Current: flags any >20% increase regardless of count
if (d > REGRESSION_THRESHOLD) regressions.push(...)
// Better: require minimum count to avoid noise on small numbers  
if (d > REGRESSION_THRESHOLD && metric.count >= 8) regressions.push(...)
```
This would eliminate false positives from categories with <8 incidents while still catching real regressions.
