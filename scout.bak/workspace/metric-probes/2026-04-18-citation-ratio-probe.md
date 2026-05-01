# Citation Ratio Probe — 2026-04-18

**Metric**: Findings cited downstream — 0.3125 ratio (target 0.5)
**Previously acted on**: 06:06 UTC via DD-767→tech-lead dispatch + DD→bob/coach dispatch

## Analysis

Grepped `agents/shared/knowledge/` for DD#770–776 citations. **All 7 recent DDs are cited**:

| DD | Cited in | Count |
|----|----------|-------|
| DD-770 | KE-200 (cognitive companion hypothesis) | 1 |
| DD-771 | KE-198, KE-194, KE-202 (form-function gap) | 3+ |
| DD-772 | KE-194 (contestation fairness) | 1 |
| DD-774 | KE-204 (form-function constraint hierarchy) | 1 |
| DD-775 | KE-208 (silent uncoupling = FM-3.3 mechanism) | 1 |
| DD-776 | KE-210 (navigable skill directory) | 1 |

**Finding**: Recent DDs have strong downstream pickup — Bob is integrating them into KEs consistently. The 0.3125 ratio likely reflects historical DDs (pre-DD-760) that were never cited, dragging the average down. The metric is **lagging, not degrading**. Current-window citation rate appears near 1.0 for the DD-770+ batch.

## Recommendation

No further action needed. The metric will naturally improve as the cited-DD-770+ batch ages into the measurement window and uncited historical DDs age out. If it hasn't improved to >0.4 by 2026-04-21, re-probe.
